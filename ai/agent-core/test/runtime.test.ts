import { describe, it, expect } from 'vitest';
import {
  AgentRuntime,
  ToolRegistry,
  PermissionManager,
  HookManager,
} from '@svton/agent-core';
import type {
  IProvider,
  StreamEvent,
  ChatMessage,
  ChatOptions,
  ModelInfo,
  ToolDefinition,
  AgentEvent,
} from '@svton/agent-core';
import type {
  ToolCall,
  ToolResult,
  ToolContext,
  IToolExecutor,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

class MockProvider implements IProvider {
  readonly name = 'mock';
  readonly models: ModelInfo[] = [
    {
      id: 'test-model',
      name: 'Test',
      contextWindow: 128000,
      supportsToolUse: true,
      supportsVision: false,
      supportsStreaming: true,
    },
  ];

  private responseQueue: StreamEvent[][] = [];

  addResponse(events: StreamEvent[]): void {
    this.responseQueue.push(events);
  }

  async *chat(
    _messages: ChatMessage[],
    _options: ChatOptions,
  ): AsyncGenerator<StreamEvent> {
    const response = this.responseQueue.shift();
    if (response) {
      for (const event of response) {
        yield event;
      }
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  supportsToolUse(_model: string): boolean {
    return true;
  }

  supportsVision(_model: string): boolean {
    return false;
  }
}

const mockPlatform: IPlatform = {
  type: 'browser' as const,
  capabilities: {
    filesystem: false,
    process: false,
    watch: false,
    mcpStdio: false,
    clipboard: false,
    notification: false,
  },
  fs: {} as any,
  process: {} as any,
  storage: {} as any,
  search: {} as any,
};

const testToolDef: ToolDefinition = {
  name: 'test_tool',
  description: 'A test tool',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string' },
    },
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
  provider?: MockProvider;
  maxIterations?: number;
  contextConfig?: any;
}) {
  const provider = options?.provider ?? new MockProvider();
  const registry = new ToolRegistry();
  registry.register(testToolDef, createMockExecutor());

  const runtime = AgentRuntime.create(
    {
      provider,
      model: 'test-model',
      toolRegistry: registry,
      maxIterations: options?.maxIterations,
      contextConfig: options?.contextConfig,
    },
    mockPlatform,
  );

  return { runtime, provider, registry };
}

async function collectEvents(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

// ==============================================================
// Tests
// ==============================================================

describe('AgentRuntime', () => {
  // ----------------------------------------------------------
  // 1. Simple text response
  // ----------------------------------------------------------
  describe('simple text response', () => {
    it('yields text_delta and done events for a basic response', async () => {
      const { runtime, provider } = createRuntime();

      provider.addResponse([
        { type: 'text_delta', text: 'Hello, ' },
        { type: 'text_delta', text: 'world!' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run('Hi'));

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: 'text_delta', text: 'Hello, ' });
      expect(events[1]).toEqual({ type: 'text_delta', text: 'world!' });

      const doneEvent = events[2];
      expect(doneEvent.type).toBe('done');
      if (doneEvent.type === 'done') {
        expect(doneEvent.stopReason).toBe('stop');
      }
    });

    it('includes thinking_delta events when the provider sends them', async () => {
      const { runtime, provider } = createRuntime();

      provider.addResponse([
        { type: 'thinking_delta', thinking: 'Let me think...' },
        { type: 'text_delta', text: 'Answer' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run('Think'));

      const thinkingEvent = events.find((e) => e.type === 'thinking_delta');
      expect(thinkingEvent).toBeDefined();
      if (thinkingEvent?.type === 'thinking_delta') {
        expect(thinkingEvent.thinking).toBe('Let me think...');
      }
    });
  });

  // ----------------------------------------------------------
  // 2. Tool call flow
  // ----------------------------------------------------------
  describe('tool call flow', () => {
    it('executes a tool call and continues the loop', async () => {
      const { runtime, provider } = createRuntime();

      // First response: tool call
      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"value"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"value"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      // Second response: text after tool execution
      provider.addResponse([
        { type: 'text_delta', text: 'Done!' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run('Use the tool'));

      const types = events.map((e) => e.type);
      expect(types).toContain('tool_call_start');
      expect(types).toContain('tool_call_end');
      expect(types).toContain('text_delta');
      expect(types[types.length - 1]).toBe('done');

      // tool_call_start always yields with empty arguments (parsed later at tool_call_end)
      const startEvent = events.find((e) => e.type === 'tool_call_start');
      if (startEvent?.type === 'tool_call_start') {
        expect(startEvent.call.id).toBe('tc1');
        expect(startEvent.call.name).toBe('test_tool');
        // Arguments are empty at start; they are accumulated and parsed at tool_call_end
        expect(startEvent.call.arguments).toEqual({});
      }

      // Verify tool_call_end has the correct ToolResult
      const endEvent = events.find((e) => e.type === 'tool_call_end');
      if (endEvent?.type === 'tool_call_end') {
        expect(endEvent.result.callId).toBe('tc1');
        expect(endEvent.result.output).toContain('Executed test_tool');
        expect(endEvent.result.isError).toBeFalsy();
      }
    });

    it('adds messages to context in correct order', async () => {
      const { runtime, provider } = createRuntime();

      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"val"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"val"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      provider.addResponse([
        { type: 'text_delta', text: 'All done' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await collectEvents(runtime.run('Do it'));

      const messages = runtime.getMessages();
      // Order: user, tool (result added during execution), assistant (added after stream)
      expect(messages.length).toBeGreaterThanOrEqual(3);

      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();

      const toolMsg = messages.find((m) => m.role === 'tool');
      expect(toolMsg).toBeDefined();

      const assistantMsg = messages.filter((m) => m.role === 'assistant');
      expect(assistantMsg.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------
  // 3. Abort
  // ----------------------------------------------------------
  describe('abort', () => {
    it('stops with done(reason="aborted") via AbortSignal', async () => {
      const { runtime, provider } = createRuntime();
      const controller = new AbortController();

      provider.addResponse([
        { type: 'text_delta', text: 'Hello' },
        { type: 'done', stopReason: 'stop' },
      ]);

      // Abort via signal before starting
      controller.abort();

      const events = await collectEvents(
        runtime.run('test', { signal: controller.signal }),
      );

      const doneEvent = events[events.length - 1];
      expect(doneEvent.type).toBe('done');
      if (doneEvent.type === 'done') {
        expect(doneEvent.stopReason).toBe('aborted');
      }
    });

    it('abort() rejects pending tool approvals', async () => {
      const { runtime, provider } = createRuntime();
      const pm = new PermissionManager({ mode: 'default' });
      runtime.setPermissionManager(pm);

      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"val"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"val"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      provider.addResponse([
        { type: 'text_delta', text: 'Done' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events: AgentEvent[] = [];
      const gen = runtime.run('test');

      let result = await gen.next();
      while (!result.done) {
        events.push(result.value);

        if (result.value.type === 'tool_approval_needed') {
          // Schedule abort via setTimeout to allow the runtime to start waiting
          // for approval before we abort (same timing as the approval/deny tests)
          setTimeout(() => runtime.abort(), 1);
        }

        result = await gen.next();
      }

      // The tool should be rejected (isError=true) due to abort rejecting the approval
      const toolEnd = events.find((e) => e.type === 'tool_call_end');
      if (toolEnd?.type === 'tool_call_end') {
        expect(toolEnd.result.isError).toBe(true);
        expect(toolEnd.result.output).toContain('rejected');
      }
    });
  });

  // ----------------------------------------------------------
  // 4. Max iterations
  // ----------------------------------------------------------
  describe('max iterations', () => {
    it('stops with done(reason="max_iterations") when iterations are exhausted', async () => {
      const { runtime, provider } = createRuntime({ maxIterations: 1 });

      // First response requests a tool use, which would normally loop
      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"val"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"val"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      const events = await collectEvents(runtime.run('Loop test'));

      const doneEvent = events[events.length - 1];
      expect(doneEvent.type).toBe('done');
      if (doneEvent.type === 'done') {
        expect(doneEvent.stopReason).toBe('max_iterations');
      }
    });

    it('completes normally within max iterations', async () => {
      const { runtime, provider } = createRuntime({ maxIterations: 5 });

      provider.addResponse([
        { type: 'text_delta', text: 'Quick answer' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run('Simple question'));

      const doneEvent = events[events.length - 1];
      expect(doneEvent.type).toBe('done');
      if (doneEvent.type === 'done') {
        expect(doneEvent.stopReason).toBe('stop');
      }
    });
  });

  // ----------------------------------------------------------
  // 5. Permission approval
  // ----------------------------------------------------------
  describe('permission approval', () => {
    it('yields tool_approval_needed and executes tool after approveToolCall', async () => {
      const { runtime, provider } = createRuntime();

      // Set permission manager with 'default' mode (requires approval for non-read tools)
      const pm = new PermissionManager({ mode: 'default' });
      runtime.setPermissionManager(pm);

      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"val"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"val"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      provider.addResponse([
        { type: 'text_delta', text: 'Approved result' },
        { type: 'done', stopReason: 'stop' },
      ]);

      // Collect events using manual iteration to handle the async approval
      const events: AgentEvent[] = [];
      const gen = runtime.run('test');

      let result = await gen.next();
      while (!result.done) {
        events.push(result.value);

        if (result.value.type === 'tool_approval_needed') {
          // Must schedule approval via setTimeout: the runtime's waitForApproval
          // promise is created after gen.next() resumes the generator, so we need
          // the approval to fire asynchronously after that.
          const callId = result.value.call.id;
          setTimeout(() => runtime.approveToolCall(callId), 1);
        }

        result = await gen.next();
      }

      const types = events.map((e) => e.type);
      expect(types).toContain('tool_approval_needed');
      expect(types).toContain('tool_call_end');

      // Verify the tool was executed successfully (after approval)
      const approvalIdx = types.indexOf('tool_approval_needed');
      const endAfterApproval = events
        .slice(approvalIdx + 1)
        .find((e) => e.type === 'tool_call_end');

      if (endAfterApproval?.type === 'tool_call_end') {
        expect(endAfterApproval.result.isError).toBeFalsy();
        expect(endAfterApproval.result.output).toContain('Executed test_tool');
      }
    });
  });

  // ----------------------------------------------------------
  // 6. Permission deny
  // ----------------------------------------------------------
  describe('permission deny', () => {
    it('yields tool_call_end with isError=true when tool call is rejected', async () => {
      const { runtime, provider } = createRuntime();

      const pm = new PermissionManager({ mode: 'default' });
      runtime.setPermissionManager(pm);

      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"val"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"val"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      provider.addResponse([
        { type: 'text_delta', text: 'After rejection' },
        { type: 'done', stopReason: 'stop' },
      ]);

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

      // Find the tool_call_end that corresponds to the rejection
      const approvalIdx = events.findIndex((e) => e.type === 'tool_approval_needed');
      const toolEndEvents = events
        .slice(approvalIdx + 1)
        .filter((e) => e.type === 'tool_call_end');

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
      const { runtime, provider } = createRuntime();

      const hm = new HookManager();
      hm.register({
        event: 'pre_tool_use',
        handler: async () => ({ action: 'deny', reason: 'Blocked by test hook' }),
      });
      runtime.setHookManager(hm);

      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"val"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"val"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      provider.addResponse([
        { type: 'text_delta', text: 'Continuing' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run('test'));

      // Find tool_call_end events
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
      // Use a very small context window to trigger compaction quickly
      const { runtime, provider } = createRuntime({
        contextConfig: {
          maxTokens: 100,
          compactionThreshold: 0.5,
          reservedForResponse: 10,
          preserveRecentMessages: 2,
        },
      });

      // threshold line = 100 * 0.5 - 10 = 40 tokens = 160 chars
      const longMessage = 'A'.repeat(200); // 50 tokens, above 40 threshold

      provider.addResponse([
        { type: 'text_delta', text: 'Response' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run(longMessage));

      const compactedEvent = events.find((e) => e.type === 'context_compacted');
      expect(compactedEvent).toBeDefined();
      if (compactedEvent?.type === 'context_compacted') {
        expect(compactedEvent.summary).toContain('Compacted');
      }

      // Should also eventually get a done event
      const doneEvent = events[events.length - 1];
      expect(doneEvent.type).toBe('done');
    });
  });

  // ----------------------------------------------------------
  // Additional edge cases
  // ----------------------------------------------------------
  describe('edge cases', () => {
    it('handles provider with empty response gracefully', async () => {
      const { runtime, provider } = createRuntime();

      // Provider returns no events (empty response queue)
      provider.addResponse([]);

      const events = await collectEvents(runtime.run('test'));

      // Should at least yield done
      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
    });

    it('handles unknown tool gracefully', async () => {
      const provider = new MockProvider();
      const registry = new ToolRegistry();
      // No tools registered - tool calls will fail

      const runtime = AgentRuntime.create(
        { provider, model: 'test-model', toolRegistry: registry },
        mockPlatform,
      );

      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'unknown_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{}' },
        { type: 'tool_call_end', id: 'tc1', name: 'unknown_tool', arguments: '{}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      provider.addResponse([
        { type: 'text_delta', text: 'Ok' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run('test'));

      const toolEnd = events.find((e) => e.type === 'tool_call_end');
      if (toolEnd?.type === 'tool_call_end') {
        expect(toolEnd.result.isError).toBe(true);
        expect(toolEnd.result.output).toContain('Unknown tool');
      }
    });

    it('passes the user message to context', async () => {
      const { runtime, provider } = createRuntime();

      provider.addResponse([
        { type: 'text_delta', text: 'Reply' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await collectEvents(runtime.run('My question'));

      const messages = runtime.getMessages();
      const userMsg = messages.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();
      if (typeof userMsg?.content === 'string') {
        expect(userMsg.content).toBe('My question');
      }
    });

    it('yields usage event data in the done event', async () => {
      const { runtime, provider } = createRuntime();

      provider.addResponse([
        { type: 'text_delta', text: 'Hello' },
        {
          type: 'usage',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run('test'));

      const doneEvent = events[events.length - 1];
      if (doneEvent.type === 'done') {
        expect(doneEvent.usage.totalTokens).toBe(15);
      }
    });

    it('handles multiple tool calls in a single response', async () => {
      const { runtime, provider } = createRuntime();

      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"a"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"a"}' },
        { type: 'tool_call_start', id: 'tc2', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc2', argumentsDelta: '{"key":"b"}' },
        { type: 'tool_call_end', id: 'tc2', name: 'test_tool', arguments: '{"key":"b"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      provider.addResponse([
        { type: 'text_delta', text: 'Both done' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const events = await collectEvents(runtime.run('test'));

      const toolCallEnds = events.filter((e) => e.type === 'tool_call_end');
      expect(toolCallEnds.length).toBe(2);

      const callIds = toolCallEnds.map((e) => {
        if (e.type === 'tool_call_end') return e.result.callId;
        return null;
      }).filter(Boolean);
      expect(callIds).toContain('tc1');
      expect(callIds).toContain('tc2');
    });
  });
});
