/**
 * Multi-turn conversation E2E tests.
 *
 * Closes the most critical gap: verifying that the ReAct loop correctly
 * accumulates messages across multiple user→assistant turns, and that tool
 * results are injected into context so the LLM can "see" them on the next
 * iteration.
 *
 * Test 1: two full turns (user→assistant→user→assistant) — asserts 4+ messages
 *         in context with correct role alternation.
 * Test 2: tool call → tool result → LLM continues — asserts the tool_result
 *         content appears in context AND the LLM's second response references it.
 * Test 3: multiple tool calls in one turn — asserts all results land in context.
 * Test 4: user message after a tool-using turn — asserts prior context persists
 *         (no messages lost between turns).
 */
import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../src/agent/runtime';
import { ToolRegistry } from '../src/tool/registry';
import { PermissionManager } from '../src/permission/manager';
import { MockProvider, createMockPlatform, collectEvents } from './helpers';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../src/tool/types';
import type { ChatMessage } from '../src/provider/types';

// A tool executor that returns a fixed result, recording calls.
function makeExecutor(output: string): { executor: IToolExecutor; calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  return {
    calls,
    executor: {
      execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => {
        calls.push(call);
        return { callId: call.id, output };
      },
    },
  };
}

function setup() {
  const provider = new MockProvider();
  const registry = new ToolRegistry();
  const { executor: diffExec, calls: diffCalls } = makeExecutor('diff: +line1\n-line2');
  registry.register({
    name: 'git_diff',
    description: 'git diff',
    parameters: { type: 'object', properties: { base: { type: 'string' } } },
  }, diffExec);

  const { executor: readExec, calls: readCalls } = makeExecutor('file contents: hello world');
  registry.register({
    name: 'file_read',
    description: 'read file',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
  }, readExec);

  const runtime = AgentRuntime.create({
    provider,
    model: 'test-model',
    toolRegistry: registry,
    capabilities: { permissionManager: new PermissionManager({ mode: 'auto' }) },
  }, createMockPlatform());

  return { runtime, provider, diffCalls, readCalls };
}

/** Extract text content from a ChatMessage's content (string or ContentBlock[]). */
function extractText(msg: ChatMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');
  }
  return '';
}

/** Extract tool_use blocks from a message. */
function extractToolUses(msg: ChatMessage): any[] {
  if (!Array.isArray(msg.content)) return [];
  return msg.content.filter((b: any) => b.type === 'tool_use');
}

/** Extract tool_result blocks from a message. */
function extractToolResults(msg: ChatMessage): any[] {
  if (!Array.isArray(msg.content)) return [];
  return msg.content.filter((b: any) => b.type === 'tool_result');
}

describe('Multi-turn conversation E2E', () => {
  it('accumulates messages across two user→assistant turns (no messages lost)', async () => {
    const { runtime, provider } = setup();
    // Turn 1
    provider.addResponse([
      { type: 'text_delta', text: 'Hello from turn 1' },
      { type: 'done', stopReason: 'stop' },
    ]);
    // Turn 2
    provider.addResponse([
      { type: 'text_delta', text: 'Hello from turn 2' },
      { type: 'done', stopReason: 'stop' },
    ]);

    await collectEvents(runtime.run('First message'));
    await collectEvents(runtime.run('Second message'));

    const msgs = runtime.getMessages();
    // Expected: user, assistant(text1), user, assistant(text2) — at least 4.
    expect(msgs.length).toBeGreaterThanOrEqual(4);

    // Roles alternate correctly
    const roles = msgs.map((m) => m.role);
    expect(roles[0]).toBe('user');
    expect(roles[1]).toBe('assistant');
    expect(roles[2]).toBe('user');
    expect(roles[3]).toBe('assistant');

    // Content preserved (not empty / not swapped)
    expect(extractText(msgs[0])).toContain('First message');
    expect(extractText(msgs[1])).toContain('Hello from turn 1');
    expect(extractText(msgs[2])).toContain('Second message');
    expect(extractText(msgs[3])).toContain('Hello from turn 2');
  });

  it('injects tool_result into context so the LLM can continue (tool → result → text)', async () => {
    const { runtime, provider, diffCalls } = setup();
    // Turn 1: LLM calls git_diff, then (after seeing the result) outputs text.
    provider
      .addResponse([
        { type: 'tool_call_start', id: 'call_1', name: 'git_diff' },
        { type: 'tool_call_delta', id: 'call_1', argumentsDelta: '{"base":"main"}' },
        { type: 'tool_call_end', id: 'call_1', name: 'git_diff', arguments: '{"base":"main"}' },
        { type: 'done', stopReason: 'tool_use' },
      ])
      .addResponse([
        { type: 'text_delta', text: 'I reviewed the diff.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(runtime.run('Review the diff'));

    const msgs = runtime.getMessages();

    // The tool was actually executed
    expect(diffCalls.length).toBe(1);
    expect(diffCalls[0].name).toBe('git_diff');

    // Find the assistant message with tool_use
    const assistantWithTool = msgs.find(
      (m) => m.role === 'assistant' && extractToolUses(m).length > 0,
    );
    expect(assistantWithTool).toBeDefined();

    // Find the tool-role message carrying the result
    const toolMsg = msgs.find(
      (m) => m.role === 'tool' && extractToolResults(m).length > 0,
    );
    expect(toolMsg).toBeDefined();
    const toolResult = extractToolResults(toolMsg!)[0];
    expect(toolResult.output).toContain('diff: +line1');
    expect(toolResult.toolUseId).toBe('call_1');
    expect(toolResult.isError).toBeFalsy();
  });

  it('handles multiple tool calls in one turn (all results land in context)', async () => {
    const { runtime, provider, diffCalls, readCalls } = setup();
    provider
      .addResponse([
        { type: 'tool_call_start', id: 'c1', name: 'git_diff' },
        { type: 'tool_call_delta', id: 'c1', argumentsDelta: '{"base":"main"}' },
        { type: 'tool_call_end', id: 'c1', name: 'git_diff', arguments: '{"base":"main"}' },
        { type: 'tool_call_start', id: 'c2', name: 'file_read' },
        { type: 'tool_call_delta', id: 'c2', argumentsDelta: '{"path":"/a.txt"}' },
        { type: 'tool_call_end', id: 'c2', name: 'file_read', arguments: '{"path":"/a.txt"}' },
        { type: 'done', stopReason: 'tool_use' },
      ])
      .addResponse([
        { type: 'text_delta', text: 'Both tools ran.' },
        { type: 'done', stopReason: 'stop' },
      ]);

    await collectEvents(runtime.run('Check diff and read file'));

    // Both tools executed
    expect(diffCalls.length).toBe(1);
    expect(readCalls.length).toBe(1);

    const msgs = runtime.getMessages();
    // Two tool-result messages in context
    const toolMsgs = msgs.filter((m) => m.role === 'tool');
    expect(toolMsgs.length).toBe(2);

    // Collect all tool_result outputs
    const allResults = toolMsgs.flatMap(extractToolResults);
    expect(allResults.length).toBe(2);
    const outputs = allResults.map((r) => r.output).sort();
    expect(outputs).toEqual(['diff: +line1\n-line2', 'file contents: hello world']);
  });

  it('preserves prior context when starting a new turn (no context loss)', async () => {
    const { runtime, provider } = setup();
    // Turn 1 with a tool call
    provider
      .addResponse([
        { type: 'tool_call_start', id: 't1', name: 'git_diff' },
        { type: 'tool_call_delta', id: 't1', argumentsDelta: '{"base":"v1"}' },
        { type: 'tool_call_end', id: 't1', name: 'git_diff', arguments: '{"base":"v1"}' },
        { type: 'done', stopReason: 'tool_use' },
      ])
      .addResponse([
        { type: 'text_delta', text: 'Diff reviewed.' },
        { type: 'done', stopReason: 'stop' },
      ]);
    // Turn 2 — pure text
    provider.addResponse([
      { type: 'text_delta', text: 'Acknowledged.' },
      { type: 'done', stopReason: 'stop' },
    ]);

    await collectEvents(runtime.run('Show diff against v1'));
    const msgsAfterTurn1 = runtime.getMessages().length;

    await collectEvents(runtime.run('Got it'));
    const msgsAfterTurn2 = runtime.getMessages();

    // Turn 2 should ADD messages, not reset
    expect(msgsAfterTurn2.length).toBeGreaterThan(msgsAfterTurn1);

    // The first user message still exists
    expect(extractText(msgsAfterTurn2[0])).toContain('Show diff against v1');

    // The tool result from turn 1 still exists
    const hasToolResult = msgsAfterTurn2.some(
      (m) => m.role === 'tool' && extractToolResults(m).length > 0,
    );
    expect(hasToolResult).toBe(true);

    // Turn 2's user + assistant messages are present
    const lastUser = [...msgsAfterTurn2].reverse().find((m) => m.role === 'user');
    expect(extractText(lastUser!)).toContain('Got it');
    const lastAssistant = [...msgsAfterTurn2].reverse().find((m) => m.role === 'assistant' && extractText(m));
    expect(extractText(lastAssistant!)).toContain('Acknowledged');
  });
});
