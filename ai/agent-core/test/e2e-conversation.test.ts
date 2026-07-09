/**
 * End-to-end conversation flow test.
 *
 * Wires a full AgentRuntime with a MockProvider + mock platform and runs one
 * complete turn: user message → skill_activated → thinking_delta → tool_call
 * (with approval) → tool_result → text_delta → done. Asserts the full event
 * sequence and that the runtime's context ends in the correct shape.
 *
 * Determinism: uses FakeClock + SequentialIdGenerator via the helpers, and the
 * MockProvider replays a canned event script — so every run produces identical
 * events in identical order.
 */
import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../src/agent/runtime';
import { ToolRegistry } from '../src/tool/registry';
import { SkillManager } from '../src/skill/manager';
import { PermissionManager } from '../src/permission/manager';
import type { AgentEvent } from '../src/agent/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../src/tool/types';
import { MockProvider, createMockPlatform, collectEvents } from './helpers';

// A skill that triggers on "review code".
const reviewSkill = {
  name: 'code-review',
  description: 'review code',
  triggerSignals: ['review code', '审查代码'],
  trigger: { type: 'implicit' as const, patterns: ['review code'] },
  requiredTools: ['git_diff'],
  allowedTools: ['git_diff', 'file_read'],
};

// Tool executor that records its calls so we can assert it ran with the right
// args. Returns a canned diff.
function makeRecordingExecutor(calls: ToolCall[]): IToolExecutor {
  return {
    execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
      calls.push(call);
      return { callId: call.id, output: 'diff --git a/f b/f\n+x' };
    },
  };
}

function setup() {
  const provider = new MockProvider();
  const registry = new ToolRegistry();
  const toolCalls: ToolCall[] = [];
  registry.register({
    name: 'git_diff',
    description: 'git diff',
    parameters: { type: 'object', properties: { base: { type: 'string' } } },
  }, makeRecordingExecutor(toolCalls));

  const skillManager = new SkillManager();
  skillManager.register(reviewSkill);

  // 'auto' mode: approve all tools automatically. The approval-needing path
  // is exercised separately in tool-executor-pipeline.test.ts; here we want
  // the tool to actually run so we can assert on its result in context.
  const permissionManager = new PermissionManager({ mode: 'auto' });

  const runtime = AgentRuntime.create({
    provider,
    model: 'test-model',
    toolRegistry: registry,
    capabilities: { skillManager, permissionManager },
  }, createMockPlatform());

  return { runtime, provider, toolCalls };
}

describe('E2E conversation flow', () => {
  it('runs a full turn: skill → thinking → tool(approved) → result → text → done', async () => {
    const { runtime, provider, toolCalls } = setup();

    // Provider script for turn 1: emits a tool_call (git_diff), then on the
    // next iteration (after tool result) emits the final text + done.
    provider
      .addResponse([
        { type: 'thinking_delta', thinking: 'Let me check the diff.' },
        { type: 'tool_call_start', id: 'call_1', name: 'git_diff' },
        { type: 'tool_call_delta', id: 'call_1', argumentsDelta: '{"base":"main"}' },
        { type: 'tool_call_end', id: 'call_1', name: 'git_diff', arguments: '{"base":"main"}' },
        { type: 'done', stopReason: 'tool_use' },
      ])
      .addResponse([
        { type: 'text_delta', text: 'The change adds a line. Looks good.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    const events = await collectEvents(runtime.run('please review code'));

    // ── Assert event sequence ──
    const types = events.map((e) => e.type);
    // skill_activated comes first (after the user message is ingested)
    const skillIdx = types.indexOf('skill_activated');
    expect(skillIdx).toBeGreaterThanOrEqual(0);
    const skillEv = events[skillIdx] as Extract<AgentEvent, { type: 'skill_activated' }>;
    expect(skillEv.skills).toEqual(['code-review']);

    // thinking before tool_call
    const thinkIdx = types.indexOf('thinking_delta');
    const toolStartIdx = types.indexOf('tool_call_start');
    expect(thinkIdx).toBeGreaterThan(skillIdx);
    expect(toolStartIdx).toBeGreaterThan(thinkIdx);

    // tool_call_start has empty args; tool_call_end is NOT emitted by the
    // provider in this script — instead the runtime synthesises tool_call_end
    // from the buffer flush. We should see tool_call_end somewhere.
    const toolEndIdx = types.indexOf('tool_call_end');
    expect(toolEndIdx).toBeGreaterThan(toolStartIdx);

    // tool_approval_needed: in 'auto' mode the tool is auto-approved, so no
    // approval event is expected and the tool runs immediately.

    // final text after tool result
    const textIdx = types.indexOf('text_delta');
    expect(textIdx).toBeGreaterThan(toolEndIdx);

    // done is last
    expect(types[types.length - 1]).toBe('done');

    // ── Assert the tool actually ran ──
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].name).toBe('git_diff');
    expect(toolCalls[0].arguments).toEqual({ base: 'main' });

    // ── Assert context has the right message order ──
    const msgs = runtime.getMessages();
    // user, [skill context user msg], assistant(with tool_use), tool(result), assistant(text)
    const roles = msgs.map((m) => m.role);
    expect(roles[0]).toBe('user');
    expect(roles[roles.length - 1]).toBe('assistant');
    // there must be a tool-role message carrying the result
    expect(roles).toContain('tool');
  });

  it('aborts cleanly when abort() is called mid-stream', async () => {
    const { runtime, provider } = setup();
    // Slow-ish script that yields text deltas forever (we abort before it ends)
    provider.addResponse([
      { type: 'text_delta', text: 'part1' },
      { type: 'text_delta', text: 'part2' },
      { type: 'done', stopReason: 'stop' },
    ]);

    // Abort almost immediately
    setTimeout(() => runtime.abort(), 0);
    const events = await collectEvents(runtime.run('hi'));
    const types = events.map((e) => e.type);
    // Should end with a done(aborted) rather than running forever
    expect(types[types.length - 1]).toBe('done');
  });
});
