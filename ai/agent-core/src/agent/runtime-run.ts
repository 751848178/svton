/**
 * Per-run orchestration for `SvtonAgentRuntime`.
 *
 * Extracted from the composition root to keep `svton-agent-runtime.ts` under
 * the 200-line ceiling (code-structure-standards). This module owns the
 * pre-run steps (hook gate, skill injection, tool refresh), the Pi `prompt()`
 * drive, and native/capability event multiplexing.
 *
 * Pi Agent owns the loop and base event semantics. This function publishes
 * each subscribed Pi event object unchanged.
 */
import type { Agent } from '@earendil-works/pi-agent-core';
import type { UserMessage } from '@earendil-works/pi-ai';
import type { ToolRegistry } from '../tool/registry';
import type { HookManager } from '../hooks/manager';
import type { SkillDefinition } from '../skill/types';
import type { AutoReviewerManager } from '../auto-reviewer/manager';
import type { SessionResumeManager } from '../checkpoint/manager';
import type { IPlatform } from '@svton/agent-platform';
import type { PublicRuntimeEvent, RunOptions } from './types';
import type { ToolExecutionService } from './tool-executor';
import type { ToolEventSink } from './pi-tool-adapter';
import type { CapabilityContext } from './runtime-capabilities';
import { createToolExecOptions } from './tool-exec-options.utils';
import { isAbortSignalAborted } from './abort-signal.utils';
import { buildPromptMessages, injectSkillContext } from './runtime-capabilities';
import { RuntimeEventMultiplexer } from './runtime-event-multiplexer';

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
  refreshTools: (sink: ToolEventSink) => () => void;
  cancelRun: (signal: AbortSignal) => void;
  /** Post-turn lifecycle hooks (memory extraction + checkpoint). PI006. */
  postTurn: (stopReason: string, sessionId: string) => Promise<void>;
}

/** Execute one user turn, yielding native Pi and Svton capability events. */
export async function* runOnce(
  deps: RunDeps,
  userMessage: UserMessage['content'],
  options: RunOptions | undefined,
): AsyncGenerator<PublicRuntimeEvent> {
  const initialSignal = deps.agent.signal;
  if (initialSignal) {
    throw new Error('Svton runtime is already processing a prompt.');
  }
  const messageText = typeof userMessage === 'string'
    ? userMessage
    : userMessage.filter((b) => b.type === 'text').map((b) => (b.type === 'text' ? b.text : '')).join('');

  const agentMatch = messageText.match(/^\/agent\s+(\S+)/);
  if (agentMatch) {
    yield {
      type: 'warning',
      text: `Agent switch to "${agentMatch[1]}" requested.`,
      source: 'agent-definition',
    };
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
  const priorSignal = deps.agent.signal;
  if (priorSignal) {
    throw new Error('Svton runtime is already processing a prompt.');
  }
  const multiplexer = new RuntimeEventMultiplexer();
  const releaseCapabilitySink = deps.refreshTools((event) => multiplexer.push(event));
  deps.toolExecService.setActiveSkills(skills);
  deps.toolExecService.setExecOptions({
    sessionId: options?.sessionId,
    signal: undefined,
    ...createToolExecOptions({ platform: deps.platform, workingDir: deps.workingDir, autoReviewer: deps.autoReviewer, resumeManager: deps.resumeManager }),
  });

  let turnCount = 0;
  let hitMaxIterations = false;
  let stopReason = 'stop';
  const maxIterations = options?.maxIterations ?? deps.maxIterations;
  const unsubscribe = deps.agent.subscribe(async (event, eventSignal) => {
    multiplexer.push(event);
    if (event.type === 'agent_start' && isAbortSignalAborted(options?.signal)) {
      deps.cancelRun(eventSignal);
    }
    if (event.type === 'message_end' && event.message.role === 'assistant') {
      stopReason = event.message.stopReason;
    }
    if (event.type === 'turn_end') {
      turnCount += 1;
      if (turnCount >= maxIterations) {
        hitMaxIterations = true;
        multiplexer.push({
          type: 'warning',
          text: `Maximum iteration count (${maxIterations}) reached.`,
          source: 'runtime',
        });
        deps.agent.abort();
      }
    }
    if (event.type === 'agent_end') {
      await deps.postTurn(
        hitMaxIterations ? 'max_iterations' : stopReason,
        options?.sessionId ?? 'default',
      );
    }
  });

  const externalSignal = options?.signal;
  let runSignal: AbortSignal | undefined;
  const forwardAbort = (): void => {
    if (runSignal) deps.cancelRun(runSignal);
  };
  if (externalSignal) {
    externalSignal.addEventListener('abort', forwardAbort, { once: true });
  }

  let runPromise: Promise<void> | null = null;
  let runSettlement: Promise<void> | null = null;
  let exhaustedNormally = false;
  try {
    runPromise = deps.agent.prompt(promptMessages);
    const candidateSignal = deps.agent.signal;
    if (candidateSignal && candidateSignal !== priorSignal) {
      runSignal = candidateSignal;
      runSettlement = deps.agent.waitForIdle();
    }
    if (isAbortSignalAborted(externalSignal) && runSignal) {
      deps.cancelRun(runSignal);
    }
    void runPromise.then(
      () => multiplexer.close(),
      () => multiplexer.close(),
    );
    while (true) {
      const next = await multiplexer.next();
      if (next === null) break;
      yield next;
    }
    await runPromise;
    exhaustedNormally = true;
  } finally {
    if (!exhaustedNormally && runSignal && deps.agent.signal === runSignal) {
      deps.cancelRun(runSignal);
    }
    await runPromise?.catch(() => {});
    await runSettlement?.catch(() => {});
    unsubscribe();
    multiplexer.close();
    releaseCapabilitySink();
    if (externalSignal) externalSignal.removeEventListener('abort', forwardAbort);
  }
}
