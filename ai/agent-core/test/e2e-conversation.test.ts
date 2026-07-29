/**
 * End-to-end conversation flow test (Pi-backed runtime).
 *
 * Wires a full SvtonAgentRuntime with a fauxProvider-backed Models collection
 * and runs one complete turn: user message → skill_activated → thinking_delta
 * → tool_call (auto-approved) → tool_result → text_delta → done. Asserts the
 * full event sequence and that the runtime's transcript ends in the correct
 * shape.
 */
import { describe, it, expect } from 'vitest';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import { SkillManager } from '../src/skill/manager';
import { PermissionManager } from '../src/permission/manager';
import {
  createMockModels,
  createMockPlatform,
  collectEvents,
  fauxAssistantMessage,
  fauxToolCall,
  fauxText,
  fauxThinking,
} from './helpers';
import { fauxProvider, createModels } from '@earendil-works/pi-ai';

/** Build a Models collection registering a single provider. */
function createModelsInstance(provider: ReturnType<typeof fauxProvider>['provider']) {
  const models = createModels();
  models.setProvider(provider);
  return models;
}
import type { AgentEvent } from '../src/agent/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../src/tool/types';

const reviewSkill = {
  name: 'code-review',
  description: 'review code',
  triggerSignals: ['review code', '审查代码'],
  trigger: { type: 'implicit' as const, patterns: ['review code'] },
  requiredTools: ['git_diff'],
  allowedTools: ['git_diff', 'file_read'],
};

function makeRecordingExecutor(calls: ToolCall[]): IToolExecutor {
  return {
    execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
      calls.push(call);
      return { callId: call.id, output: 'diff --git a/f b/f\n+x' };
    },
  };
}

function setup() {
  const mock = createMockModels();
  const registry = new ToolRegistry();
  const toolCalls: ToolCall[] = [];
  registry.register(
    { name: 'git_diff', description: 'git diff', parameters: { type: 'object', properties: { base: { type: 'string' } } } },
    makeRecordingExecutor(toolCalls),
  );
  const skillManager = new SkillManager();
  skillManager.register(reviewSkill);
  const permissionManager = new PermissionManager({ mode: 'auto' });
  const runtime = SvtonAgentRuntime.create(
    {
      models: mock.models,
      piModel: mock.model,
      model: 'test-model',
      toolRegistry: registry,
      capabilities: { skillManager, permissionManager },
    },
    createMockPlatform(),
  );
  return { runtime, mock, toolCalls };
}

describe('E2E conversation flow (Pi-backed)', () => {
  it('runs a full turn: skill → thinking → tool(approved) → result → text → done', async () => {
    const { runtime, mock, toolCalls } = setup();
    mock.addResponse(
      fauxAssistantMessage([
        fauxThinking('Let me check the diff.'),
        fauxToolCall('git_diff', { base: 'main' }),
      ]),
    );
    mock.addResponse(fauxAssistantMessage([fauxText('The change adds a line. Looks good.')]));

    const events = await collectEvents(runtime.run('please review code'));

    const types = events.map((e) => e.type);
    const skillIdx = types.indexOf('skill_activated');
    expect(skillIdx).toBeGreaterThanOrEqual(0);
    const skillEv = events[skillIdx] as Extract<AgentEvent, { type: 'skill_activated' }>;
    expect(skillEv.skills).toEqual(['code-review']);

    const thinkIdx = types.indexOf('thinking_delta');
    const toolStartIdx = types.indexOf('tool_call_start');
    expect(thinkIdx).toBeGreaterThan(skillIdx);
    expect(toolStartIdx).toBeGreaterThan(thinkIdx);

    const toolEndIdx = types.indexOf('tool_call_end');
    expect(toolEndIdx).toBeGreaterThan(toolStartIdx);

    const textIdx = types.indexOf('text_delta');
    expect(textIdx).toBeGreaterThan(toolEndIdx);

    expect(types[types.length - 1]).toBe('done');

    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].name).toBe('git_diff');
    expect(toolCalls[0].arguments).toEqual({ base: 'main' });

    const msgs = runtime.getMessages();
    const roles = msgs.map((m) => m.role);
    expect(roles[0]).toBe('user');
    expect(roles[roles.length - 1]).toBe('assistant');
    expect(roles).toContain('tool');
  });

  it('aborts cleanly when abort() is called mid-stream', async () => {
    // Use a dedicated slow faux provider so the stream spans multiple ticks,
    // giving the abort a window to fire mid-stream (the shared createMockModels
    // helper streams text as a single synchronous delta).
    const slow = fauxProvider({
      api: 'openai-responses',
      provider: 'openai',
      models: [{ id: 'test-model' }],
      tokensPerSecond: 1000,
      tokenSize: { min: 3, max: 5 },
    });
    const slowModels = createModelsInstance(slow.provider);
    slow.setResponses([fauxAssistantMessage([fauxText('part1 part2 part3 part4 part5')])]);
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
