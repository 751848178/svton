/**
 * Native Pi streaming and settlement ordering.
 *
 * Native message updates precede tool execution, native tool settlement
 * precedes the next assistant update, and `agent_end` is terminal.
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
  it('passes native thinking, tool execution, text, and settlement in order', async () => {
    const { runtime, mock } = setup();
    // Turn 1: thinking → tool call → (tool result) → final text
    mock.addResponse(fauxAssistantMessage([fauxThinking('planning'), fauxToolCall('git_diff', {})]));
    mock.addResponse(fauxAssistantMessage([fauxText('final answer')]));

    const events = await collectEvents(runtime.run('go'));
    const types = events.map((e) => e.type);

    const thinkingIdx = events.findIndex((event) =>
      event.type === 'message_update'
      && event.assistantMessageEvent.type === 'thinking_delta',
    );
    const toolStartIdx = types.indexOf('tool_execution_start');
    const toolEndIdx = types.indexOf('tool_execution_end');
    const textIdx = events.findIndex((event) =>
      event.type === 'message_update'
      && event.assistantMessageEvent.type === 'text_delta',
    );
    const settledIdx = types.indexOf('agent_end');

    // All expected events present.
    expect(thinkingIdx).toBeGreaterThanOrEqual(0);
    expect(toolStartIdx).toBeGreaterThanOrEqual(0);
    expect(toolEndIdx).toBeGreaterThanOrEqual(0);
    expect(textIdx).toBeGreaterThanOrEqual(0);
    expect(settledIdx).toBeGreaterThanOrEqual(0);

    // Ordering invariants.
    expect(thinkingIdx).toBeLessThan(toolStartIdx);   // thinking streams before tool start
    expect(toolStartIdx).toBeLessThan(toolEndIdx);     // tool start before tool end
    expect(toolEndIdx).toBeLessThan(textIdx);          // tool end before next-turn text
    expect(settledIdx).toBe(types.length - 1);

    const assistantEnd = events.find((event) =>
      event.type === 'message_end' && event.message.role === 'assistant',
    );
    expect(assistantEnd?.type).toBe('message_end');
    if (assistantEnd?.type === 'message_end' && assistantEnd.message.role === 'assistant') {
      expect(assistantEnd.message.stopReason).toBe('stop');
      expect(assistantEnd.message.usage.totalTokens).toBeDefined();
    }
  });

  it('preserves native settlement across two turns', async () => {
    const { runtime, mock } = setup();
    mock.addResponse(fauxAssistantMessage([fauxText('turn1 text')]));
    mock.addResponse(fauxAssistantMessage([fauxToolCall('git_diff', {})]));
    mock.addResponse(fauxAssistantMessage([fauxText('turn2 final')]));

    const t1 = await collectEvents(runtime.run('first'));
    const t2 = await collectEvents(runtime.run('second'));

    expect(t1[t1.length - 1].type).toBe('agent_end');
    expect(t2[t2.length - 1].type).toBe('agent_end');

    // Turn 2: tool end precedes the post-tool text.
    const t2types = t2.map((e) => e.type);
    const t2ToolEnd = t2types.indexOf('tool_execution_end');
    const t2Text = t2.findIndex((event) =>
      event.type === 'message_update'
      && event.assistantMessageEvent.type === 'text_delta',
    );
    expect(t2ToolEnd).toBeGreaterThanOrEqual(0);
    expect(t2Text).toBeGreaterThan(t2ToolEnd);

    expect(t1.slice(0, -1).some((event) => event.type === 'agent_end')).toBe(false);
    expect(t2.slice(0, -1).some((event) => event.type === 'agent_end')).toBe(false);
  });

  it('emits an aborted assistant message before native settlement', async () => {
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
    expect(events.some((event) =>
      event.type === 'message_end'
      && event.message.role === 'assistant'
      && event.message.stopReason === 'aborted',
    )).toBe(true);
    expect(events.at(-1)?.type).toBe('agent_end');
  });
});
