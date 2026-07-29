/**
 * Multi-turn conversation E2E tests (Pi-backed runtime).
 *
 * Verifies that the Pi-owned ReAct loop correctly accumulates messages across
 * multiple user→assistant turns, and that tool results are injected into the
 * transcript so the LLM can "see" them on the next iteration.
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
  fauxToolCall,
  fauxText,
  type MockModelsHandle,
} from './helpers';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../src/tool/types';
import type { ChatMessage } from '../src/tool/types';

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
  const mock = createMockModels();
  const registry = new ToolRegistry();
  const { executor: diffExec, calls: diffCalls } = makeExecutor('diff: +line1\n-line2');
  registry.register(
    { name: 'git_diff', description: 'git diff', parameters: { type: 'object', properties: { base: { type: 'string' } } } },
    diffExec,
  );
  const { executor: readExec, calls: readCalls } = makeExecutor('file contents: hello world');
  registry.register(
    { name: 'file_read', description: 'read file', parameters: { type: 'object', properties: { path: { type: 'string' } } } },
    readExec,
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
  return { runtime, mock, diffCalls, readCalls };
}

function extractText(msg: ChatMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  }
  return '';
}

function extractToolUses(msg: ChatMessage): any[] {
  if (!Array.isArray(msg.content)) return [];
  return msg.content.filter((b: any) => b.type === 'tool_use');
}

function extractToolResults(msg: ChatMessage): any[] {
  if (!Array.isArray(msg.content)) return [];
  return msg.content.filter((b: any) => b.type === 'tool_result');
}

describe('Multi-turn conversation E2E (Pi-backed)', () => {
  it('accumulates messages across two user→assistant turns (no messages lost)', async () => {
    const { runtime, mock } = setup();
    mock.addResponse(fauxAssistantMessage([fauxText('Hello from turn 1')]));
    mock.addResponse(fauxAssistantMessage([fauxText('Hello from turn 2')]));

    await collectEvents(runtime.run('First message'));
    await collectEvents(runtime.run('Second message'));

    const msgs = runtime.getMessages();
    expect(msgs.length).toBeGreaterThanOrEqual(4);

    const roles = msgs.map((m) => m.role);
    expect(roles[0]).toBe('user');
    expect(roles[1]).toBe('assistant');
    expect(roles[2]).toBe('user');
    expect(roles[3]).toBe('assistant');

    expect(extractText(msgs[0])).toContain('First message');
    expect(extractText(msgs[1])).toContain('Hello from turn 1');
    expect(extractText(msgs[2])).toContain('Second message');
    expect(extractText(msgs[3])).toContain('Hello from turn 2');
  });

  it('injects tool_result into context so the LLM can continue (tool → result → text)', async () => {
    const { runtime, mock, diffCalls } = setup();
    mock.addResponse(fauxAssistantMessage([fauxToolCall('git_diff', { base: 'main' })]));
    mock.addResponse(fauxAssistantMessage([fauxText('I reviewed the diff.')]));

    await collectEvents(runtime.run('Review the diff'));

    const msgs = runtime.getMessages();
    expect(diffCalls.length).toBe(1);
    expect(diffCalls[0].name).toBe('git_diff');

    const assistantWithTool = msgs.find((m) => m.role === 'assistant' && extractToolUses(m).length > 0);
    expect(assistantWithTool).toBeDefined();

    const toolMsg = msgs.find((m) => m.role === 'tool' && extractToolResults(m).length > 0);
    expect(toolMsg).toBeDefined();
    const toolResult = extractToolResults(toolMsg!)[0];
    expect(toolResult.output).toContain('diff: +line1');
    expect(toolResult.isError).toBeFalsy();
  });

  it('handles multiple tool calls in one turn (all results land in context)', async () => {
    const { runtime, mock, diffCalls, readCalls } = setup();
    mock.addResponse(
      fauxAssistantMessage([
        fauxToolCall('git_diff', { base: 'main' }),
        fauxToolCall('file_read', { path: '/a.txt' }),
      ]),
    );
    mock.addResponse(fauxAssistantMessage([fauxText('Both tools ran.')]));

    await collectEvents(runtime.run('Check diff and read file'));

    expect(diffCalls.length).toBe(1);
    expect(readCalls.length).toBe(1);

    const msgs = runtime.getMessages();
    const toolMsgs = msgs.filter((m) => m.role === 'tool');
    expect(toolMsgs.length).toBe(2);
    const allResults = toolMsgs.flatMap(extractToolResults);
    expect(allResults.length).toBe(2);
    const outputs = allResults.map((r) => r.output).sort();
    expect(outputs).toEqual(['diff: +line1\n-line2', 'file contents: hello world']);
  });

  it('preserves prior context when starting a new turn (no context loss)', async () => {
    const { runtime, mock } = setup();
    mock.addResponse(fauxAssistantMessage([fauxToolCall('git_diff', { base: 'v1' })]));
    mock.addResponse(fauxAssistantMessage([fauxText('Diff reviewed.')]));
    mock.addResponse(fauxAssistantMessage([fauxText('Acknowledged.')]));

    await collectEvents(runtime.run('Show diff against v1'));
    const msgsAfterTurn1 = runtime.getMessages().length;

    await collectEvents(runtime.run('Got it'));
    const msgsAfterTurn2 = runtime.getMessages();

    expect(msgsAfterTurn2.length).toBeGreaterThan(msgsAfterTurn1);
    expect(extractText(msgsAfterTurn2[0])).toContain('Show diff against v1');

    const hasToolResult = msgsAfterTurn2.some((m) => m.role === 'tool' && extractToolResults(m).length > 0);
    expect(hasToolResult).toBe(true);

    const lastUser = [...msgsAfterTurn2].reverse().find((m) => m.role === 'user');
    expect(extractText(lastUser!)).toContain('Got it');
    const lastAssistant = [...msgsAfterTurn2].reverse().find((m) => m.role === 'assistant' && extractText(m));
    expect(extractText(lastAssistant!)).toContain('Acknowledged');
  });
});
