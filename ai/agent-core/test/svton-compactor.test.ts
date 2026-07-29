/**
 * SvtonCompactor + compaction-via-transformContext tests (PI004).
 *
 * Two layers:
 *  1. Unit tests on `SvtonCompactor` — directly exercise the prune/summarize/
 *     report logic and prove the contract Pi's `transformContext` relies on
 *     (never rejects, injects a summary user message, preserves recent N).
 *  2. End-to-end test through `SvtonAgentRuntime` — proves the compactor wired
 *     into Pi's `transformContext` emits a `context_compacted` AgentEvent, the
 *     run completes, the transcript + tool-result integrity survive, and a
 *     subsequent turn resumes.
 *
 * Architectural note (Architecture §5.4 / Pi contract): Pi Agent keeps the
 * full append-only transcript in `agent.state.messages`; `transformContext`
 * produces a TRANSIENT pruned+summarized VIEW handed to the LLM for that call
 * only. The compacted list is NOT persisted back into state. Therefore the
 * e2e assertions verify the compaction RAN (event + reporter) and that state
 * integrity is preserved — they do NOT assert the summary message persists in
 * `getMessages()` (it correctly does not).
 *
 * No network: `createMockModels()` + `fauxProvider` script all LLM responses.
 */
import { describe, it, expect } from 'vitest';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import { PermissionManager } from '../src/permission/manager';
import { SvtonCompactor } from '../src/agent/svton-compactor';
import {
  createMockModels,
  createMockPlatform,
  collectEvents,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
} from './helpers';
import type { AgentEvent, ChatMessage } from '../src/agent/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../src/tool/types';

/** Long filler text that pushes the transcript over a tiny token budget. */
function bigText(label: string): string {
  return `${label}: ` + 'x'.repeat(4000);
}

/**
 * Build a stub `Models.streamSimple` that yields a fixed summary string.
 *
 * Mirrors the real pi-ai contract: `streamSimple` returns an AsyncIterable
 * synchronously (it is NOT an `async function`, which would wrap the iterable
 * in a Promise and break the compactor's `for await … of stream` iteration).
 */
function stubStreamSimple(summary: string) {
  return function streamSimple() {
    return (async function* () {
      yield { type: 'text_delta', delta: summary };
    })();
  };
}

describe('SvtonCompactor (unit, transformContext contract)', () => {
  it('returns the original messages unchanged when below the threshold', async () => {
    const compactor = new SvtonCompactor({ maxTokens: 100000, threshold: 0.8 });
    const messages = [
      { role: 'user', content: 'short', timestamp: Date.now() },
      { role: 'assistant', content: [{ type: 'text', text: 'reply' }], timestamp: Date.now() },
    ] as any;
    let reported = false;
    const transform = compactor.toTransformContext(() => { reported = true; });
    const out = await transform(messages, undefined);
    expect(out).toBe(messages);
    expect(reported).toBe(false);
  });

  it('prunes, reports removed count, and keeps only preserveRecent when no LLM is bound', async () => {
    const compactor = new SvtonCompactor({
      maxTokens: 100, threshold: 0.5, reservedForResponse: 0, preserveRecentMessages: 2,
    });
    const messages: any[] = [];
    for (let i = 0; i < 6; i++) {
      messages.push({ role: 'user', content: bigText(`u-${i}`), timestamp: Date.now() });
    }
    let outcome: { removed: number; summary?: string } | null = null;
    const transform = compactor.toTransformContext((o) => { outcome = o; });
    const out = await transform(messages, undefined);
    expect(out.length).toBe(2); // only preserveRecent kept
    expect(outcome).not.toBeNull();
    expect(outcome!.removed).toBe(4);
    expect(outcome!.summary).toBeUndefined(); // no LLM → no summary text
  });

  it('injects a [Conversation Summary] user message at the head when an LLM is bound', async () => {
    const compactor = new SvtonCompactor({
      maxTokens: 100, threshold: 0.5, reservedForResponse: 0, preserveRecentMessages: 2,
    });
    compactor.bind({ streamSimple: stubStreamSimple('KEY DECISION: ship it') } as any, {} as any);
    const messages: any[] = [];
    for (let i = 0; i < 5; i++) {
      messages.push({ role: 'user', content: bigText(`u-${i}`), timestamp: Date.now() });
    }
    let outcome: { removed: number; summary?: string } | null = null;
    const out = await compactor.toTransformContext((o) => { outcome = o; })(messages, undefined);
    // Summary message is the first item, tagged with the svton summary header.
    expect(out.length).toBe(3); // 1 summary + 2 preserveRecent
    const summaryMsg = out[0] as any;
    expect(summaryMsg.role).toBe('user');
    expect(typeof summaryMsg.content).toBe('string');
    expect(summaryMsg.content).toContain('[Conversation Summary]');
    expect(summaryMsg.content).toContain('KEY DECISION: ship it');
    // Recent messages preserved verbatim at the tail.
    expect((out[1] as any).content).toContain('u-3');
    expect((out[2] as any).content).toContain('u-4');
    // Report carries the summary text + removed count.
    expect(outcome!.removed).toBe(3);
    expect(outcome!.summary).toContain('KEY DECISION');
  });

  it('never rejects from transformContext even if the bound LLM throws', async () => {
    const compactor = new SvtonCompactor({
      maxTokens: 1, threshold: 0.1, reservedForResponse: 0, preserveRecentMessages: 1,
    });
    compactor.bind(
      { streamSimple: () => { throw new Error('boom'); } } as any,
      {} as any,
    );
    const messages = [{ role: 'user', content: bigText('x'), timestamp: Date.now() }] as any;
    const out = await compactor.toTransformContext()(messages, undefined);
    // transformContext must never reject (Architecture §5.4); graceful fallback.
    expect(Array.isArray(out)).toBe(true);
  });

  it('respects an aborted signal by stopping the summarization early', async () => {
    const compactor = new SvtonCompactor({
      maxTokens: 1, threshold: 0.1, reservedForResponse: 0, preserveRecentMessages: 1,
    });
    const messages = [{ role: 'user', content: bigText('x'), timestamp: Date.now() }] as any;
    const controller = new AbortController();
    controller.abort();
    // Aborted signal: must still return a valid list (never throw).
    const out = await compactor.toTransformContext()(messages, controller.signal);
    expect(Array.isArray(out)).toBe(true);
  });
});

describe('Compaction via SvtonAgentRuntime.transformContext (e2e)', () => {
  function buildSeedTranscript(): ChatMessage[] {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 6; i++) {
      msgs.push({ role: 'user', content: bigText(`history-user-${i}`) });
      msgs.push({
        role: 'assistant',
        content: [{ type: 'text', text: bigText(`history-assistant-${i}`) }],
      });
    }
    return msgs;
  }

  function extractText(msg: ChatMessage): string {
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    }
    return '';
  }

  function makeExecutor(): { executor: IToolExecutor; calls: ToolCall[] } {
    const calls: ToolCall[] = [];
    return {
      calls,
      executor: {
        execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
          calls.push(call);
          return { callId: call.id, output: 'tool-output-payload' };
        },
      },
    };
  }

  it('emits context_compacted, keeps transcript + tool-result integrity, resumes after compaction', async () => {
    const mock = createMockModels();
    const registry = new ToolRegistry();
    const { executor, calls: toolCalls } = makeExecutor();
    registry.register(
      { name: 'git_diff', description: 'git diff', parameters: { type: 'object', properties: {} } },
      executor,
    );
    const runtime = SvtonAgentRuntime.create(
      {
        models: mock.models,
        piModel: mock.model,
        model: 'test-model',
        toolRegistry: registry,
        capabilities: { permissionManager: new PermissionManager({ mode: 'auto' }) },
        contextConfig: {
          maxTokens: 1000,
          compactionThreshold: 0.5,
          reservedForResponse: 0,
          preserveRecentMessages: 4,
        },
        initialMessages: buildSeedTranscript(),
      },
      createMockPlatform(),
    );

    // Compaction fires inside transformContext before EACH main LLM call and
    // itself consumes one summarizer response from the shared faux queue. With
    // a tool-call turn there are 2 main LLM calls → 2 summarizer + 2 main
    // responses must be queued in consumption order.
    mock.addResponse(fauxAssistantMessage([fauxText('SUMMARY-A')]));        // summarizer for call 1
    mock.addResponse(fauxAssistantMessage([fauxToolCall('git_diff', {})])); // main call 1
    mock.addResponse(fauxAssistantMessage([fauxText('SUMMARY-B')]));        // summarizer for call 2
    mock.addResponse(fauxAssistantMessage([fauxText('Done after compaction.')])); // main call 2

    const events = await collectEvents(runtime.run('proceed'));

    // (a) context_compacted AgentEvent(s) emitted.
    const compacted = events.filter((e) => e.type === 'context_compacted');
    expect(compacted.length).toBeGreaterThanOrEqual(1);
    for (const ev of compacted) {
      expect((ev as Extract<AgentEvent, { type: 'context_compacted' }>).summary).toContain('Compacted');
    }

    // (b) Pi keeps the full append-only transcript (transformContext is a
    //     transient view); the seeded history + new turn are all present.
    const msgs = runtime.getMessages();
    expect(msgs.some((m) => extractText(m).includes('history-user-0'))).toBe(true);
    expect(msgs.some((m) => m.role === 'user' && extractText(m).includes('proceed'))).toBe(true);

    // (c) tool-result integrity: the tool ran and its result message is present.
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].name).toBe('git_diff');
    expect(msgs.some((m) => m.role === 'tool')).toBe(true);

    // (d) the run settles with a terminal done carrying usage + stopReason.
    const last = events[events.length - 1];
    expect(last.type).toBe('done');
    if (last.type === 'done') {
      expect(typeof last.stopReason).toBe('string');
      expect(last.usage.totalTokens).toBeDefined();
    }

    // (e) resume after compaction: a second turn completes normally on the
    //     same runtime (state intact, no compaction-related corruption).
    mock.addResponse(fauxAssistantMessage([fauxText('SUMMARY-C')]));
    mock.addResponse(fauxAssistantMessage([fauxText('Resume reply.')]));
    const events2 = await collectEvents(runtime.run('continue'));
    expect(events2[events2.length - 1].type).toBe('done');
    const msgs2 = runtime.getMessages();
    expect(msgs2.some((m) => m.role === 'assistant' && extractText(m).includes('Resume reply'))).toBe(true);
  });

  it('does not compact when the transcript stays under budget (no context_compacted event)', async () => {
    const mock = createMockModels();
    const registry = new ToolRegistry();
    const runtime = SvtonAgentRuntime.create(
      {
        models: mock.models,
        piModel: mock.model,
        model: 'test-model',
        toolRegistry: registry,
        capabilities: { permissionManager: new PermissionManager({ mode: 'auto' }) },
        contextConfig: { maxTokens: 1_000_000, threshold: 0.9, preserveRecentMessages: 6 },
      },
      createMockPlatform(),
    );
    mock.addResponse(fauxAssistantMessage([fauxText('short reply')]));

    const events = await collectEvents(runtime.run('hi'));
    expect(events.some((e) => e.type === 'context_compacted')).toBe(false);
    expect(events[events.length - 1].type).toBe('done');
  });
});
