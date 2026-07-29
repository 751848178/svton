/**
 * Streaming + settlement event-ordering tests (PI004).
 *
 * Asserts the Pi-base event contract consumers rely on:
 *  - text_delta / thinking_delta stream BEFORE the first tool_call_start of a turn
 *  - tool_call_end arrives BEFORE the next turn's text_delta
 *  - the terminal `done` is LAST and carries usage + a stopReason
 *  - across two turns, settlement ordering is preserved (done ends each turn)
 *
 * The existing e2e suites cover much of this incidentally; this file makes the
 * ordering invariants explicit so regressions in pi-event-adapter mapping land
 * here first.
 */
import { describe, it, expect } from 'vitest';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import { PermissionManager } from '../src/permission/manager';
import {
  createMockModels,
  createMockPlatform,
  collectEvents,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
  fauxThinking,
} from './helpers';
import { fauxProvider, createModels } from '@earendil-works/pi-ai';
import type { AgentEvent } from '../src/agent/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../src/tool/types';

function makeExecutor(output: string): { executor: IToolExecutor; calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  return {
    calls,
    executor: {
      execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => ({
        callId: call.id,
        output,
      }),
    },
  };
}

function setup() {
  const mock = createMockModels();
  const registry = new ToolRegistry();
  const { executor, calls } = makeExecutor('result-payload');
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
    },
    createMockPlatform(),
  );
  return { runtime, mock, calls };
}

describe('Streaming + settlement ordering', () => {
  it('streams thinking before tool_call_start, tool_call_end before the next text, done last', async () => {
    const { runtime, mock } = setup();
    // Turn 1: thinking → tool call → (tool result) → final text
    mock.addResponse(fauxAssistantMessage([fauxThinking('planning'), fauxToolCall('git_diff', {})]));
    mock.addResponse(fauxAssistantMessage([fauxText('final answer')]));

    const events = await collectEvents(runtime.run('go'));
    const types = events.map((e) => e.type);

    const thinkingIdx = types.indexOf('thinking_delta');
    const toolStartIdx = types.indexOf('tool_call_start');
    const toolEndIdx = types.indexOf('tool_call_end');
    const textIdx = types.indexOf('text_delta');
    const doneIdx = types.indexOf('done');

    // All expected events present.
    expect(thinkingIdx).toBeGreaterThanOrEqual(0);
    expect(toolStartIdx).toBeGreaterThanOrEqual(0);
    expect(toolEndIdx).toBeGreaterThanOrEqual(0);
    expect(textIdx).toBeGreaterThanOrEqual(0);
    expect(doneIdx).toBeGreaterThanOrEqual(0);

    // Ordering invariants.
    expect(thinkingIdx).toBeLessThan(toolStartIdx);   // thinking streams before tool start
    expect(toolStartIdx).toBeLessThan(toolEndIdx);     // tool start before tool end
    expect(toolEndIdx).toBeLessThan(textIdx);          // tool end before next-turn text
    expect(doneIdx).toBe(types.length - 1);            // done is terminal/last

    // done carries usage + a stopReason.
    const done = events[doneIdx] as Extract<AgentEvent, { type: 'done' }>;
    expect(typeof done.stopReason).toBe('string');
    expect(done.usage).toBeDefined();
    expect(done.usage.totalTokens).toBeDefined();
  });

  it('preserves per-turn settlement across two turns (each turn ends with done)', async () => {
    const { runtime, mock } = setup();
    mock.addResponse(fauxAssistantMessage([fauxText('turn1 text')]));
    mock.addResponse(fauxAssistantMessage([fauxToolCall('git_diff', {})]));
    mock.addResponse(fauxAssistantMessage([fauxText('turn2 final')]));

    const t1 = await collectEvents(runtime.run('first'));
    const t2 = await collectEvents(runtime.run('second'));

    // Each turn settles with a terminal done.
    expect(t1[t1.length - 1].type).toBe('done');
    expect(t2[t2.length - 1].type).toBe('done');

    // Turn 2: tool end precedes the post-tool text.
    const t2types = t2.map((e) => e.type);
    const t2ToolEnd = t2types.indexOf('tool_call_end');
    const t2Text = t2types.indexOf('text_delta');
    expect(t2ToolEnd).toBeGreaterThanOrEqual(0);
    expect(t2Text).toBeGreaterThan(t2ToolEnd);

    // No event after done in either turn.
    expect(t1.slice(0, -1).some((e) => e.type === 'done')).toBe(false);
    expect(t2.slice(0, -1).some((e) => e.type === 'done')).toBe(false);
  });

  it('emits done with stopReason="aborted" when the run is aborted mid-stream', async () => {
    // Slow provider so abort lands mid-stream.
    const slow = fauxProvider({
      api: 'openai-responses',
      provider: 'openai',
      models: [{ id: 'test-model' }],
      tokensPerSecond: 500,
      tokenSize: { min: 2, max: 4 },
    });
    const slowModels = createModels();
    slowModels.setProvider(slow.provider);
    slow.setResponses([fauxAssistantMessage([fauxText('aaaaaaaaaa bbbbbbbbbb cccccccccc dddddddddd')])]);

    const registry = new ToolRegistry();
    const runtime = SvtonAgentRuntime.create(
      {
        models: slowModels,
        piModel: slow.getModel('test-model') ?? slow.getModel(),
        model: 'test-model',
        toolRegistry: registry,
        capabilities: { permissionManager: new PermissionManager({ mode: 'auto' }) },
      },
      createMockPlatform(),
    );
    setTimeout(() => runtime.abort(), 0);
    const events = await collectEvents(runtime.run('go'));
    const last = events[events.length - 1];
    expect(last.type).toBe('done');
    if (last.type === 'done') expect(last.stopReason).toBe('aborted');
  });
});
