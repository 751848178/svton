/**
 * Per-run orchestration for `SvtonAgentRuntime`.
 *
 * Extracted from the composition root to keep `svton-agent-runtime.ts` under
 * the 200-line ceiling (code-structure-standards). This module owns the
 * pre-run steps (hook gate, skill injection, tool refresh), the Pi `prompt()`
 * drive + event drain, and the terminal stop-reason resolution.
 *
 * Pi Agent owns the loop; this function only wires svton capabilities around
 * one `agent.prompt()` invocation and translates the resulting events.
 */
import type { Agent } from '@earendil-works/pi-agent-core';
import type { ToolRegistry } from '../tool/registry';
import type { HookManager } from '../hooks/manager';
import type { SkillDefinition } from '../skill/types';
import type { AutoReviewerManager } from '../auto-reviewer/manager';
import type { SessionResumeManager } from '../checkpoint/manager';
import type { IPlatform } from '@svton/agent-platform';
import type { AgentEvent, ContentBlock, RunOptions } from './types';
import type { ToolExecutionService } from './tool-executor';
import { PiEventAdapter } from './pi-event-adapter';
import type { ToolEventSink } from './pi-tool-adapter';
import type { CapabilityContext } from './runtime-capabilities';
import { createToolExecOptions } from './tool-exec-options.utils';
import { isAbortSignalAborted } from './abort-signal.utils';
import { buildPromptMessages, injectSkillContext } from './runtime-capabilities';
import { piUsageToTokenUsage } from './pi-usage.utils';

/** Internal handles the runtime passes to `runOnce`. */
export interface RunDeps {
  agent: Agent;
  toolRegistry: ToolRegistry;
  toolExecService: ToolExecutionService;
  hookManager: HookManager | null;
  platform: IPlatform;
  workingDir: string;
  autoReviewer: AutoReviewerManager | null;
  resumeManager: SessionResumeManager | null;
  capabilityContext: CapabilityContext;
  maxIterations: number;
  onActiveSkills: (skills: SkillDefinition[]) => void;
  refreshTools: (sink: ToolEventSink) => void;
  /** Post-turn lifecycle hooks (memory extraction + checkpoint). PI006. */
  postTurn: (stopReason: string, sessionId: string) => void;
}

/** Execute one user turn against the Pi Agent, yielding svton AgentEvents. */
export async function* runOnce(
  deps: RunDeps,
  userMessage: string | ContentBlock[],
  options: RunOptions | undefined,
  doneEvent: (reason: string, usage?: unknown) => AgentEvent,
): AsyncGenerator<AgentEvent> {
  if (isAbortSignalAborted(options?.signal)) {
    yield doneEvent('aborted');
    return;
  }
  const messageText = typeof userMessage === 'string'
    ? userMessage
    : userMessage.filter((b) => b.type === 'text').map((b) => (b.type === 'text' ? b.text : '')).join('');

  const agentMatch = messageText.match(/^\/agent\s+(\S+)/);
  if (agentMatch) {
    yield { type: 'text_delta', text: `Agent switch to "${agentMatch[1]}" requested.` };
    yield doneEvent('stop');
    return;
  }
  if (deps.hookManager) {
    const r = await deps.hookManager.trigger('session_start', { event: 'session_start' });
    if (r.action === 'deny') yield { type: 'warning', text: `Session blocked by hook: ${r.reason}`, source: 'hook' };
  }
  if (deps.toolRegistry.listDefinitions().length === 0) {
    yield { type: 'warning', text: 'No tools registered.', source: 'runtime' };
  }

  const { skills, contextMessage } = await injectSkillContext(
    deps.capabilityContext, messageText, deps.autoReviewer, deps.resumeManager,
  );
  deps.onActiveSkills(skills);
  if (skills.length > 0) yield { type: 'skill_activated', skills: skills.map((s) => s.name) };
  if (contextMessage) deps.agent.state.messages = [...deps.agent.state.messages, contextMessage];

  const promptMessages = buildPromptMessages(userMessage);
  const adapter = new PiEventAdapter();
  deps.refreshTools((ev) => adapter.push(ev));
  deps.toolExecService.setActiveSkills(skills);
  deps.toolExecService.setExecOptions({
    sessionId: options?.sessionId,
    signal: undefined,
    ...createToolExecOptions({ platform: deps.platform, workingDir: deps.workingDir, autoReviewer: deps.autoReviewer, resumeManager: deps.resumeManager }),
  });

  let turnCount = 0;
  let hitMaxIterations = false;
  const maxIterations = options?.maxIterations ?? deps.maxIterations;
  const unsubscribe = deps.agent.subscribe(async (event) => {
    if (event.type === 'turn_end') {
      turnCount += 1;
      if (turnCount >= maxIterations) {
        hitMaxIterations = true;
        deps.agent.abort();
      }
    }
    await adapter.handle(event);
  });

  const externalSignal = options?.signal;
  const forwardAbort = () => deps.agent.abort();
  if (externalSignal) {
    if (externalSignal.aborted) deps.agent.abort();
    else externalSignal.addEventListener('abort', forwardAbort, { once: true });
  }

  try {
    const runPromise = deps.agent.prompt(promptMessages).finally(() => adapter.close());
    while (true) {
      const next = await adapter.next();
      if (next === null) break;
      yield next;
    }
    await runPromise.catch(() => { /* errors surfaced via message_end(error) */ });
  } finally {
    unsubscribe();
    if (externalSignal) externalSignal.removeEventListener('abort', forwardAbort);
  }

  const piReason = adapter.getStopReason();
  const stopReason = hitMaxIterations ? 'max_iterations' : piReason === 'error' ? 'error' : piReason;

  // PI006: reattach memory extraction + checkpoint. This MUST run BEFORE
  // yielding the terminal `done` event — consumers (`chat-stream-runner`) break
  // out of the generator on `done`, so any code after the yield would never run.
  // Running it pre-done guarantees the checkpoint + memory extraction fire.
  deps.postTurn(stopReason, options?.sessionId ?? 'default');

  yield doneEvent(stopReason, piUsageToTokenUsage(adapter.getUsage()));
}
