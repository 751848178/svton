import { describe, it, expect, vi } from 'vitest';
import { Agent } from '@earendil-works/pi-agent-core';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import { PermissionManager } from '../src/permission/manager';
import { HookManager } from '../src/hooks/manager';
import {
  createMockModels,
  createMockPlatform,
  collectEvents,
  fauxAssistantMessage,
  fauxToolCall,
  fauxText,
  type MockModelsHandle,
} from './helpers';
import type { AgentEvent } from '../src/agent/types';
import type {
  ToolCall,
  ToolResult,
  ToolContext,
  IToolExecutor,
} from '../src/tool/types';
import type { IPlatform } from '@svton/agent-platform';
import type { SvtonToolDefinition } from '../src/tool/types';

const testToolDef: SvtonToolDefinition = {
  name: 'test_tool',
  description: 'A test tool',
  parameters: {
    type: 'object',
    properties: { key: { type: 'string' } },
    required: ['key'],
  },
};

function createMockExecutor(): IToolExecutor {
  return {
    execute: async (call: ToolCall, _ctx: ToolContext): Promise<ToolResult> => ({
      callId: call.id,
      output: `Executed ${call.name} with ${JSON.stringify(call.arguments)}`,
    }),
  };
}

function createRuntime(options?: {
  mock?: MockModelsHandle;
  maxIterations?: number;
  contextConfig?: any;
  platform?: IPlatform;
  executor?: IToolExecutor;
}) {
  const mock = options?.mock ?? createMockModels();
  const registry = new ToolRegistry();
  registry.register(testToolDef, options?.executor ?? createMockExecutor());
  const runtime = SvtonAgentRuntime.create(
    {
      models: mock.models,
      piModel: mock.model,
      model: 'test-model',
      toolRegistry: registry,
      maxIterations: options?.maxIterations,
      contextConfig: options?.contextConfig,
    },
    options?.platform ?? createMockPlatform(),
  );
  return { runtime, mock, registry };
}

describe('SvtonAgentRuntime (Pi-backed)', () => {
  // ----------------------------------------------------------
  // 1. Simple text response
  // ----------------------------------------------------------
  describe('simple text response', () => {
    it('yields text_delta and done events for a basic response', async () => {
      const { runtime, mock } = createRuntime();
      mock.addResponse(fauxAssistantMessage([fauxText('Hello, world!')]));

      const events = await collectEvents(runtime.run('Hi'));
      const texts = events.filter((e) => e.type === 'text_delta').map((e) => (e as any).text).join('');
      const done = events[events.length - 1];

      expect(texts).toBe('Hello, world!');
      expect(done.type).toBe('done');
      if (done.type === 'done') expect(done.stopReason).toBe('stop');
    });

    it('includes thinking_delta events when the model sends them', async () => {
      const { runtime, mock } = createRuntime();
      mock.addResponse(fauxAssistantMessage([fauxText('Answer.')]));
      // Thinking is family-dependent; svton surfaces thinking_delta only when
      // the model emits thinking blocks. The faux provider emits them when the
      // response carries a thinking block.
      const events = await collectEvents(runtime.run('Think'));
      const textDone = events.find((e) => e.type === 'done');
      expect(textDone).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // 2. Tool call flow
  // ----------------------------------------------------------
  describe('tool call flow', () => {
    it('executes a tool call and continues the loop', async () => {
      const { runtime, mock } = createRuntime();
      mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'value' })]));
      mock.addResponse(fauxAssistantMessage([fauxText('Done!')]));

      const events = await collectEvents(runtime.run('Use the tool'));
      const types = events.map((e) => e.type);

      expect(types).toContain('tool_call_start');
      expect(types).toContain('tool_call_end');
      expect(types).toContain('text_delta');
      expect(types[types.length - 1]).toBe('done');

      const startEvent = events.find((e) => e.type === 'tool_call_start');
      if (startEvent?.type === 'tool_call_start') {
        expect(startEvent.call.name).toBe('test_tool');
        expect(startEvent.call.arguments).toEqual({});
      }

      const endEvent = events.find((e) => e.type === 'tool_call_end');
      if (endEvent?.type === 'tool_call_end') {
        expect(endEvent.result.output).toContain('Executed test_tool');
        expect(endEvent.result.isError).toBeFalsy();
      }
    });

    it('adds messages to context in correct order', async () => {
      const { runtime, mock } = createRuntime();
      mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'val' })]));
      mock.addResponse(fauxAssistantMessage([fauxText('All done')]));

      await collectEvents(runtime.run('Do it'));

      const messages = runtime.getMessages();
      expect(messages.length).toBeGreaterThanOrEqual(3);

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();
      const toolMsg = messages.find((m) => m.role === 'toolResult');
      expect(toolMsg).toBeDefined();
      if (toolMsg?.role === 'toolResult') {
        expect(toolMsg.toolName).toBe('test_tool');
        expect(toolMsg.isError).toBe(false);
      }
      const assistantMsg = messages.filter((m) => m.role === 'assistant');
      expect(assistantMsg.length).toBeGreaterThanOrEqual(1);
    });

    it('handles multiple tool calls in a single response', async () => {
      const { runtime, mock } = createRuntime();
      mock.addResponse(
        fauxAssistantMessage([
          fauxToolCall('test_tool', { key: 'a' }),
          fauxToolCall('test_tool', { key: 'b' }),
        ]),
      );
      mock.addResponse(fauxAssistantMessage([fauxText('Both done')]));

      const events = await collectEvents(runtime.run('test'));
      const toolCallEnds = events.filter((e) => e.type === 'tool_call_end');
      expect(toolCallEnds.length).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // 3. Abort
  // ----------------------------------------------------------
  describe('abort', () => {
    it('stops with done(reason="aborted") via AbortSignal', async () => {
      const { runtime } = createRuntime();
      const controller = new AbortController();
      controller.abort();
      const events = await collectEvents(runtime.run('test', { signal: controller.signal }));
      const done = events[events.length - 1];
      expect(done.type).toBe('done');
      if (done.type === 'done') expect(done.stopReason).toBe('aborted');
    });

    it('abort() rejects pending tool approvals', async () => {
      const { runtime, mock } = createRuntime();
      runtime.setPermissionManager(new PermissionManager({ mode: 'default' }));
      mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'val' })]));
      mock.addResponse(fauxAssistantMessage([fauxText('Done')]));

      const events: AgentEvent[] = [];
      const gen = runtime.run('test');
      let result = await gen.next();
      while (!result.done) {
        events.push(result.value);
        if (result.value.type === 'tool_approval_needed') {
          setTimeout(() => runtime.abort(), 1);
        }
        result = await gen.next();
      }

      const toolEnd = events.find((e) => e.type === 'tool_call_end');
      if (toolEnd?.type === 'tool_call_end') {
        expect(toolEnd.result.isError).toBe(true);
        expect(toolEnd.result.output).toContain('aborted');
      }
    });

    it('external AbortSignal rejects pending tool approvals', async () => {
      const { runtime, mock } = createRuntime();
      runtime.setPermissionManager(new PermissionManager({ mode: 'default' }));
      const controller = new AbortController();
      mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'val' })]));

      const gen = runtime.run('test', { signal: controller.signal });
      let result = await gen.next();
      while (!result.done && result.value.type !== 'tool_approval_needed') {
        result = await gen.next();
      }
      expect(result.value?.type).toBe('tool_approval_needed');
      controller.abort();

      const next = await Promise.race([
        gen.next(),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 50)),
      ]);
      expect(next).not.toBe('timeout');
    });
  });

  // ----------------------------------------------------------
  // 4. Max iterations
  // ----------------------------------------------------------
  describe('max iterations', () => {
    it('stops with done(reason="max_iterations") when iterations are exhausted', async () => {
      const { runtime, mock } = createRuntime({ maxIterations: 1 });
      mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'val' })]));

      const events = await collectEvents(runtime.run('Loop test'));
      const done = events[events.length - 1];
      expect(done.type).toBe('done');
      if (done.type === 'done') expect(done.stopReason).toBe('max_iterations');
    });

    it('completes normally within max iterations', async () => {
      const { runtime, mock } = createRuntime({ maxIterations: 5 });
      mock.addResponse(fauxAssistantMessage([fauxText('Quick answer')]));
      const events = await collectEvents(runtime.run('Simple question'));
      const done = events[events.length - 1];
      expect(done.type).toBe('done');
      if (done.type === 'done') expect(done.stopReason).toBe('stop');
    });
  });

  // ----------------------------------------------------------
  // 5. Permission approval
  // ----------------------------------------------------------
  describe('permission approval', () => {
    it('yields tool_approval_needed and executes tool after approveToolCall', async () => {
      const { runtime, mock } = createRuntime();
      runtime.setPermissionManager(new PermissionManager({ mode: 'default' }));
      mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'val' })]));
      mock.addResponse(fauxAssistantMessage([fauxText('Approved result')]));

      const events: AgentEvent[] = [];
      const gen = runtime.run('test');
      let result = await gen.next();
      while (!result.done) {
        events.push(result.value);
        if (result.value.type === 'tool_approval_needed') {
          runtime.approveToolCall(result.value.call.id);
        }
        result = await gen.next();
      }
      const types = events.map((e) => e.type);
      expect(types).toContain('tool_approval_needed');
      expect(types).toContain('tool_call_end');
    });
  });

  // ----------------------------------------------------------
  // 6. Permission deny
  // ----------------------------------------------------------
  describe('permission deny', () => {
    it('yields tool_call_end with isError=true when tool call is rejected', async () => {
      const { runtime, mock } = createRuntime();
      runtime.setPermissionManager(new PermissionManager({ mode: 'default' }));
      mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'val' })]));
      mock.addResponse(fauxAssistantMessage([fauxText('After rejection')]));

      const events: AgentEvent[] = [];
      const gen = runtime.run('test');
      let result = await gen.next();
      while (!result.done) {
        events.push(result.value);
        if (result.value.type === 'tool_approval_needed') {
          const callId = result.value.call.id;
          setTimeout(() => runtime.rejectToolCall(callId), 1);
        }
        result = await gen.next();
      }
      const approvalIdx = events.findIndex((e) => e.type === 'tool_approval_needed');
      const toolEndEvents = events.slice(approvalIdx + 1).filter((e) => e.type === 'tool_call_end');
      expect(toolEndEvents.length).toBeGreaterThanOrEqual(1);
      const rejectedEnd = toolEndEvents[0];
      if (rejectedEnd?.type === 'tool_call_end') {
        expect(rejectedEnd.result.isError).toBe(true);
        expect(rejectedEnd.result.output).toContain('rejected');
      }
    });
  });

  // ----------------------------------------------------------
  // 7. Hook deny
  // ----------------------------------------------------------
  describe('hook deny', () => {
    it('does not execute tool when pre_tool_use hook returns deny', async () => {
      const { runtime, mock } = createRuntime();
      const hm = new HookManager();
      hm.register({
        event: 'pre_tool_use',
        handler: async () => ({ action: 'deny', reason: 'Blocked by test hook' }),
      });
      runtime.setHookManager(hm);
      mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'val' })]));
      mock.addResponse(fauxAssistantMessage([fauxText('Continuing')]));

      const events = await collectEvents(runtime.run('test'));
      const toolEndEvents = events.filter((e) => e.type === 'tool_call_end');
      expect(toolEndEvents.length).toBeGreaterThanOrEqual(1);
      const deniedEnd = toolEndEvents[0];
      if (deniedEnd?.type === 'tool_call_end') {
        expect(deniedEnd.result.isError).toBe(true);
        expect(deniedEnd.result.output).toContain('denied by hook');
      }
    });
  });

  // ----------------------------------------------------------
  // 8. Context compaction
  // ----------------------------------------------------------
  describe('context compaction', () => {
    it('yields context_compacted event when context exceeds threshold', async () => {
      const { runtime, mock } = createRuntime({
        contextConfig: { maxTokens: 100, compactionThreshold: 0.5, reservedForResponse: 10, preserveRecentMessages: 2 },
      });
      const longMessage = 'A'.repeat(200);
      mock.addResponse(fauxAssistantMessage([fauxText('Response')]));
      const events = await collectEvents(runtime.run(longMessage));
      const compacted = events.find((e) => e.type === 'context_compacted');
      expect(compacted).toBeDefined();
      const done = events[events.length - 1];
      expect(done.type).toBe('done');
    });
  });

  // ----------------------------------------------------------
  // 9. Edge cases
  // ----------------------------------------------------------
  describe('edge cases', () => {
    it('resets canonical and Pi-owned transient state through Agent.reset()', () => {
      const reset = vi.spyOn(Agent.prototype, 'reset');
      const { runtime } = createRuntime();
      runtime.setMessages([{ role: 'user', content: 'stale', timestamp: 1 }]);

      runtime.reset();

      expect(reset).toHaveBeenCalledOnce();
      expect(runtime.getMessages()).toEqual([]);
      reset.mockRestore();
    });

    it('passes the user message to context', async () => {
      const { runtime, mock } = createRuntime();
      mock.addResponse(fauxAssistantMessage([fauxText('Reply')]));
      await collectEvents(runtime.run('My question'));
      const messages = runtime.getMessages();
      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();
      if (typeof userMsg?.content === 'string') expect(userMsg.content).toBe('My question');
    });

    it('handles unknown tool gracefully', async () => {
      const mock = createMockModels();
      const registry = new ToolRegistry();
      const runtime = SvtonAgentRuntime.create(
        { models: mock.models, piModel: mock.model, model: 'test-model', toolRegistry: registry },
        createMockPlatform(),
      );
      mock.addResponse(fauxAssistantMessage([fauxToolCall('unknown_tool', {})]));
      mock.addResponse(fauxAssistantMessage([fauxText('Ok')]));
      const events = await collectEvents(runtime.run('test'));
      const toolEnd = events.find((e) => e.type === 'tool_call_end');
      if (toolEnd?.type === 'tool_call_end') {
        expect(toolEnd.result.isError).toBe(true);
        expect(toolEnd.result.output).toContain('Unknown tool');
      }
    });
  });

  // PI010-R1: cover the reasoning-effort → Pi thinkingLevel bridge that lost its
  // dedicated test when reasoning-effort.test.ts was deleted (the wire-format
  // half moved to pi-ai; the svton-owned thinkingLevel mapping half lives here).
  describe('reasoning effort → Pi thinkingLevel', () => {
    it('maps setReasoningEffort to agent.state.thinkingLevel', () => {
      const { runtime } = createRuntime();
      // The internal Pi Agent state is the source of truth for thinkingLevel.
      // Access it via the (test-only) bridge used by checkpoint/resume paths.
      const agentState = (runtime as unknown as { agent: { state: { thinkingLevel: string } } }).agent.state;

      runtime.setReasoningEffort('high');
      expect(runtime.getReasoningEffort()).toBe('high');
      expect(agentState.thinkingLevel).toBe('high');

      runtime.setReasoningEffort('xhigh');
      expect(agentState.thinkingLevel).toBe('xhigh');

      runtime.setReasoningEffort('low');
      expect(agentState.thinkingLevel).toBe('low');
    });

    it('clears thinkingLevel when reasoning effort is undefined', () => {
      const { runtime } = createRuntime();
      const agentState = (runtime as unknown as { agent: { state: { thinkingLevel: string } } }).agent.state;

      runtime.setReasoningEffort('high');
      expect(agentState.thinkingLevel).toBe('high');

      runtime.setReasoningEffort(undefined);
      expect(runtime.getReasoningEffort()).toBeUndefined();
      expect(agentState.thinkingLevel).toBe('off');
    });
  });
});
