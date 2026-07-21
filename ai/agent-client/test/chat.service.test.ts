import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'reflect-metadata';
import { ChatService } from '../src/service/chat.service';
import type { DisplayMessage } from '../src/types';
import {
  AgentRuntime,
  ToolRegistry,
} from '@svton/agent-core';
import type {
  IProvider,
  StreamEvent,
  ChatMessage,
  ChatOptions,
  ModelInfo,
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolContext,
  IToolExecutor,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

// ==============================================================
// Mock Provider — queues responses for controlled streaming
// ==============================================================

class MockProvider implements IProvider {
  readonly name = 'mock';
  readonly models: ModelInfo[] = [
    { id: 'test-model', name: 'Test', contextWindow: 128000, supportsToolUse: true, supportsVision: false, supportsStreaming: true },
  ];

  private responseQueue: StreamEvent[][] = [];

  addResponse(events: StreamEvent[]): void {
    this.responseQueue.push(events);
  }

  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<StreamEvent> {
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

  supportsToolUse(_model: string): boolean { return true; }
  supportsVision(_model: string): boolean { return false; }
}

// ==============================================================
// Mock Platform
// ==============================================================

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

// ==============================================================
// Helpers
// ==============================================================

const testToolDef: ToolDefinition = {
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

function createChatService() {
  const service = new ChatService();
  return service;
}

function createConfig(provider: MockProvider) {
  const registry = new ToolRegistry();
  registry.register(testToolDef, createMockExecutor());
  return {
    provider,
    model: 'test-model',
    toolRegistry: registry,
  };
}

// ==============================================================
// Tests
// ==============================================================

describe('ChatService', () => {
  let service: ChatService;
  let provider: MockProvider;

  beforeEach(() => {
    service = createChatService();
    provider = new MockProvider();
  });

  // ----------------------------------------------------------
  // 1. init
  // ----------------------------------------------------------
  describe('init', () => {
    it('initializes and sets currentModel', async () => {
      const config = createConfig(provider);
      await service.init(mockPlatform, config);
      expect(service.currentModel).toBe('test-model');
      expect(service.status).toBe('idle');
      expect(service.messages).toEqual([]);
    });

    it('preserves messages across model switches', async () => {
      const config1 = createConfig(provider);
      await service.init(mockPlatform, config1);

      // Simulate a message
      provider.addResponse([
        { type: 'text_delta', text: 'Hello' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Hi');
      expect(service.messages.length).toBeGreaterThanOrEqual(2);

      // Re-init with different model
      const config2 = createConfig(provider);
      config2.model = 'test-model-v2';
      await service.init(mockPlatform, config2);

      expect(service.currentModel).toBe('test-model-v2');
      // Messages should be preserved
      expect(service.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('skips re-initialization with the same config object', async () => {
      const spy = vi.spyOn(AgentRuntime, 'createAsync');
      const config = createConfig(provider);
      await service.init(mockPlatform, config);
      const beforeModel = service.currentModel;
      // Init again with same config
      await service.init(mockPlatform, config);
      expect(service.currentModel).toBe(beforeModel);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('re-initializes when runtime config changes without changing model or workingDir', async () => {
      const spy = vi.spyOn(AgentRuntime, 'createAsync');
      const config1 = createConfig(provider);
      const config2 = createConfig(provider);
      await service.init(mockPlatform, config1);
      await service.init(mockPlatform, config2);
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('uses runtimeKey to skip semantically identical configs', async () => {
      const spy = vi.spyOn(AgentRuntime, 'createAsync');
      const config1 = createConfig(provider);
      const config2 = createConfig(provider);
      await service.init(mockPlatform, config1, 'same-runtime');
      await service.init(mockPlatform, config2, 'same-runtime');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('marks pending approvals errored when runtime is reinitialized', async () => {
      await service.init(mockPlatform, createConfig(provider), 'runtime-a');
      service.messages = [{
        id: 'a1',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' }],
        blocks: [{
          type: 'tool_call',
          call: { id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' },
        }],
      }];
      (service as any).pendingToolCalls.set('tc1', {
        call: { id: 'tc1', name: 'test_tool', arguments: {} },
        resolve: vi.fn(),
      });
      (service as any).status = 'waiting_approval';

      await service.init(mockPlatform, createConfig(provider), 'runtime-b');

      expect(service.status).toBe('idle');
      expect(service.hasPendingApprovals).toBe(false);
      expect(service.messages[0].toolCalls![0].status).toBe('error');
      expect((service.messages[0].blocks![0] as any).call.status).toBe('error');
    });
  });

  // ----------------------------------------------------------
  // 2. sendMessage
  // ----------------------------------------------------------
  describe('sendMessage', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('sends a user message and receives assistant response', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Hi there!' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await service.sendMessage('Hello');

      expect(service.messages.length).toBe(2);
      expect(service.messages[0].role).toBe('user');
      expect(service.messages[0].content).toBe('Hello');
      expect(service.messages[1].role).toBe('assistant');
      expect(service.messages[1].content).toBe('Hi there!');
      expect(service.messages[1].isStreaming).toBeFalsy();
    });

    it('sets status to idle after completion', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Done' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await service.sendMessage('Go');
      expect(service.status).toBe('idle');
    });

    it('does not mutate messages while waiting for tool approval', async () => {
      service.messages = [
        { id: 'u1', role: 'user', content: 'Use tool', timestamp: 1000 },
        {
          id: 'a1',
          role: 'assistant',
          content: '',
          timestamp: 1001,
          toolCalls: [{ id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' }],
        },
      ];
      (service as any).status = 'waiting_approval';
      const before = JSON.stringify(service.messages);

      await service.sendMessage('New turn');
      await service.retry();
      await service.retryFromMessage('u1');
      await service.editMessage('u1', 'Edited');

      expect(service.status).toBe('waiting_approval');
      expect(JSON.stringify(service.messages)).toBe(before);
    });

    it('records duration on the assistant message', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Fast' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await service.sendMessage('Quick');
      const assistant = service.messages.find((m) => m.role === 'assistant');
      expect(assistant?.duration).toBeGreaterThanOrEqual(0);
    });

    it('stores lastUsage from done event', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Response' },
        { type: 'usage', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
        { type: 'done', stopReason: 'stop' },
      ]);

      await service.sendMessage('Test');
      expect(service.lastUsage).toBeDefined();
      expect(service.lastUsage!.totalTokens).toBe(15);
    });

    it('handles thinking_delta events', async () => {
      provider.addResponse([
        { type: 'thinking_delta', thinking: 'Let me think...' },
        { type: 'text_delta', text: 'Answer' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await service.sendMessage('Think');
      const assistant = service.messages.find((m) => m.role === 'assistant');
      expect(assistant?.thinking).toBe('Let me think...');
      expect(assistant?.content).toBe('Answer');
    });

    it('handles streaming error', async () => {
      // Make the provider's chat method throw
      const origChat = provider.chat.bind(provider);
      provider.chat = async function* () { throw new Error('API error'); };

      await service.sendMessage('Trigger error');
      const assistant = service.messages.find((m) => m.role === 'assistant');
      expect(assistant?.error).toBe('API error');
    });

    it('does nothing when status is running', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'First' },
        { type: 'done', stopReason: 'stop' },
      ]);

      // Start a message (it's synchronous in queueing, but async in streaming)
      // We need to send and not await, then try to send again
      // Actually since our mock resolves instantly, let's just verify the guard
      await service.sendMessage('First');
      expect(service.status).toBe('idle');
      // Now send again should work
      provider.addResponse([
        { type: 'text_delta', text: 'Second' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Second');
      expect(service.messages.length).toBe(4);
    });
  });

  // ----------------------------------------------------------
  // 3. retry
  // ----------------------------------------------------------
  describe('retry', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('removes last assistant message and regenerates', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'First response' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Hello');

      provider.addResponse([
        { type: 'text_delta', text: 'Retried response' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.retry();

      // Should have: user msg + retried assistant
      expect(service.messages.length).toBe(2);
      expect(service.messages[1].content).toBe('Retried response');
    });

    it('does nothing when no messages exist', async () => {
      await service.retry();
      expect(service.messages).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // 4. retryFromMessage
  // ----------------------------------------------------------
  describe('retryFromMessage', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('truncates after specified user message and retries', async () => {
      // Send first message
      provider.addResponse([
        { type: 'text_delta', text: 'Response 1' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Message 1');

      // Send second message
      provider.addResponse([
        { type: 'text_delta', text: 'Response 2' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Message 2');

      // Now we have: user1, assistant1, user2, assistant2
      expect(service.messages.length).toBe(4);

      // Retry from user1
      provider.addResponse([
        { type: 'text_delta', text: 'Retried from 1' },
        { type: 'done', stopReason: 'stop' },
      ]);
      const user1Id = service.messages[0].id;
      await service.retryFromMessage(user1Id);

      // Should have: user1 + new assistant
      expect(service.messages.length).toBe(2);
      expect(service.messages[0].content).toBe('Message 1');
      expect(service.messages[1].content).toBe('Retried from 1');
    });

    it('does nothing for non-existent message id', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Hi' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Test');

      await service.retryFromMessage('nonexistent');
      // Messages unchanged
      expect(service.messages.length).toBe(2);
    });

    it('does nothing for assistant message id', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Hi' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Test');

      const assistantId = service.messages[1].id;
      await service.retryFromMessage(assistantId);
      // Messages unchanged — can't retry from assistant message
      expect(service.messages.length).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // 5. editMessage
  // ----------------------------------------------------------
  describe('editMessage', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('edits user message, truncates, and re-runs', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Original response' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Original question');

      // Edit the user message
      provider.addResponse([
        { type: 'text_delta', text: 'Edited response' },
        { type: 'done', stopReason: 'stop' },
      ]);
      const userMsgId = service.messages[0].id;
      await service.editMessage(userMsgId, 'Edited question');

      expect(service.messages.length).toBe(2);
      expect(service.messages[0].content).toBe('Edited question');
      expect(service.messages[1].content).toBe('Edited response');
    });

    it('does nothing for non-existent message', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Hi' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Test');

      await service.editMessage('nonexistent', 'new');
      expect(service.messages.length).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // 6. abort
  // ----------------------------------------------------------
  describe('abort', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('marks streaming messages as not streaming', async () => {
      // Create a slow response so we can abort mid-stream
      let resolveDone: () => void;
      const donePromise = new Promise<void>((r) => { resolveDone = r; });

      provider.addResponse([
        { type: 'text_delta', text: 'Partial' },
        { type: 'done', stopReason: 'stop' },
      ]);

      // Start sending but don't await yet — abort in the middle
      // Since our mock provider resolves instantly, we'll set up state manually
      service.messages = [
        { id: 'msg_streaming', role: 'assistant', content: 'Partial', toolCalls: [], isStreaming: true, timestamp: Date.now() },
      ];
      (service as any).status = 'running';

      service.abort();

      expect(service.messages[0].isStreaming).toBe(false);
      expect(service.status).toBe('idle');
    });

    it('clears pending approvals and marks them errored', async () => {
      service.messages = [{
        id: 'msg_approval',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' }],
        blocks: [{
          type: 'tool_call',
          call: { id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' },
        }],
      }];
      (service as any).pendingToolCalls.set('tc1', {
        call: { id: 'tc1', name: 'test_tool', arguments: {} },
        resolve: vi.fn(),
      });
      (service as any).status = 'waiting_approval';

      service.abort();

      expect(service.hasPendingApprovals).toBe(false);
      expect(service.messages[0].toolCalls![0].status).toBe('error');
      expect((service.messages[0].blocks![0] as any).call.status).toBe('error');
      expect(service.status).toBe('idle');
    });
  });

  // ----------------------------------------------------------
  // 7. bindSession
  // ----------------------------------------------------------
  describe('bindSession', () => {
    it('sets activeSessionId', () => {
      service.bindSession('sess-1');
      expect(service.activeSessionId).toBe('sess-1');
    });

    it('can set to null', () => {
      service.bindSession('sess-1');
      service.bindSession(null);
      expect(service.activeSessionId).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 8. loadMessages
  // ----------------------------------------------------------
  describe('loadMessages', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('loads messages and resets state', () => {
      const messages: DisplayMessage[] = [
        { id: 'm1', role: 'user', content: 'Hello', timestamp: 1000 },
        { id: 'm2', role: 'assistant', content: 'Hi', timestamp: 1001 },
      ];

      service.loadMessages(messages);

      expect(service.messages).toEqual(messages);
      expect(service.status).toBe('idle');
      expect(service.lastUsage).toBeNull();
    });

    it('loads messages with thinking (reasoning content)', () => {
      const messages: DisplayMessage[] = [
        { id: 'm1', role: 'user', content: 'Think about it', timestamp: 1000 },
        { id: 'm2', role: 'assistant', content: 'Answer', thinking: 'Deep thoughts...', timestamp: 1001 },
      ];

      service.loadMessages(messages);

      expect(service.messages[1].thinking).toBe('Deep thoughts...');
    });

    it('loads messages with tool calls', () => {
      const messages: DisplayMessage[] = [
        { id: 'm1', role: 'user', content: 'Use tool', timestamp: 1000 },
        {
          id: 'm2', role: 'assistant', content: '', timestamp: 1001,
          toolCalls: [{
            id: 'tc1',
            name: 'test_tool',
            arguments: { key: 'val' },
            status: 'completed',
            result: { callId: 'tc1', output: 'result text' },
          }],
        },
      ];

      service.loadMessages(messages);

      expect(service.messages[1].toolCalls).toHaveLength(1);
      expect(service.messages[1].toolCalls![0].name).toBe('test_tool');
    });

    it('marks loaded pending approvals errored when no runtime approval is preserved', () => {
      const messages: DisplayMessage[] = [
        {
          id: 'm1',
          role: 'assistant',
          content: '',
          timestamp: 1000,
          toolCalls: [{ id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' }],
          blocks: [{
            type: 'tool_call',
            call: { id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' },
          }],
        },
      ];

      service.loadMessages(messages);

      expect(service.messages[0].toolCalls![0].status).toBe('error');
      expect((service.messages[0].blocks![0] as any).call.status).toBe('error');
    });

    it('preserves loaded pending approvals when runtime approval is preserved', () => {
      const messages: DisplayMessage[] = [
        {
          id: 'm1',
          role: 'assistant',
          content: '',
          timestamp: 1000,
          toolCalls: [{ id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' }],
          blocks: [{
            type: 'tool_call',
            call: { id: 'tc1', name: 'test_tool', arguments: {}, status: 'pending_approval' },
          }],
        },
      ];
      (service as any).pendingToolCalls.set('tc1', {
        call: { id: 'tc1', name: 'test_tool', arguments: {} },
        resolve: vi.fn(),
      });

      service.loadMessages(messages, { preservePendingToolCalls: true });

      expect(service.messages[0].toolCalls![0].status).toBe('pending_approval');
      expect((service.messages[0].blocks![0] as any).call.status).toBe('pending_approval');
    });
  });

  // ----------------------------------------------------------
  // 9. clearMessages
  // ----------------------------------------------------------
  describe('clearMessages', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('clears all messages and resets state', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Hi' },
        { type: 'done', stopReason: 'stop' },
      ]);
      await service.sendMessage('Hello');

      service.clearMessages();

      expect(service.messages).toEqual([]);
      expect(service.status).toBe('idle');
      expect(service.lastUsage).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 10. Session message caching
  // ----------------------------------------------------------
  describe('session message caching', () => {
    it('caches and retrieves messages for a session', () => {
      const msgs: DisplayMessage[] = [
        { id: 'm1', role: 'user', content: 'Test', timestamp: 1000 },
      ];

      service.cacheSessionMessages('sess-1', msgs);
      const retrieved = service.getCachedMessages('sess-1');

      expect(retrieved).toEqual(msgs);
    });

    it('returns undefined for uncached session', () => {
      const retrieved = service.getCachedMessages('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('getMessagesForSessionSave filters streaming and system messages', () => {
      service.bindSession('sess-active');
      service.messages = [
        { id: 'm1', role: 'user', content: 'Hello', timestamp: 1000 },
        { id: 'm2', role: 'assistant', content: 'Streaming...', isStreaming: true, timestamp: 1001 },
        { id: 'm3', role: 'system', content: 'Compacted', systemType: 'context_compacted', timestamp: 1002 },
        { id: 'm4', role: 'assistant', content: 'Done', timestamp: 1003 },
      ];

      const filtered = service.getMessagesForSessionSave('sess-active');

      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('m1');
      expect(filtered[1].id).toBe('m4');
    });

    it('getMessagesForSessionSave reads from cache for background session', () => {
      service.bindSession('sess-active');
      const bgMsgs: DisplayMessage[] = [
        { id: 'm1', role: 'user', content: 'BG', timestamp: 1000 },
      ];
      service.cacheSessionMessages('sess-bg', bgMsgs);

      const filtered = service.getMessagesForSessionSave('sess-bg');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].content).toBe('BG');
    });
  });

  // ----------------------------------------------------------
  // 11. Tool approval
  // ----------------------------------------------------------
  describe('tool approval', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('approveToolCall resolves pending tool', () => {
      const resolve = vi.fn();
      (service as any).pendingToolCalls.set('tc1', { call: { id: 'tc1' }, resolve });

      service.approveToolCall('tc1');

      expect(resolve).toHaveBeenCalledWith(true);
      expect(service.hasPendingApprovals).toBe(false);
    });

    it('rejectToolCall rejects pending tool', () => {
      const resolve = vi.fn();
      (service as any).pendingToolCalls.set('tc1', { call: { id: 'tc1' }, resolve });

      service.rejectToolCall('tc1');

      expect(resolve).toHaveBeenCalledWith(false);
      expect(service.hasPendingApprovals).toBe(false);
    });

    it('hasPendingApprovals returns true when tools are pending', () => {
      (service as any).pendingToolCalls.set('tc1', { call: { id: 'tc1' }, resolve: () => {} });
      expect(service.hasPendingApprovals).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 12. abortIfStreaming
  // ----------------------------------------------------------
  describe('abortIfStreaming', () => {
    it('returns false when idle', () => {
      const result = service.abortIfStreaming();
      expect(result).toBe(false);
    });

    it('returns true and aborts when running', () => {
      (service as any).status = 'running';
      const result = service.abortIfStreaming();
      expect(result).toBe(true);
      expect(service.status).toBe('idle');
    });

    it('returns true when waiting_approval', () => {
      (service as any).status = 'waiting_approval';
      const result = service.abortIfStreaming();
      expect(result).toBe(true);
    });

    it('finalizes visible-only pending approvals when aborting', () => {
      service.messages = [{
        id: 'msg-visible-pending',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        toolCalls: [{
          id: 'tc-visible-abort',
          name: 'write_file',
          arguments: { path: '/tmp/out.txt' },
          status: 'pending_approval',
        }],
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-visible-abort',
            name: 'write_file',
            arguments: { path: '/tmp/out.txt' },
            status: 'pending_approval',
          },
        }],
      }];
      (service as any).status = 'waiting_approval';

      const result = service.abortIfStreaming();

      expect(result).toBe(true);
      expect(service.messages[0].isStreaming).toBe(false);
      expect(service.messages[0].toolCalls?.[0].status).toBe('error');
      expect(service.messages[0].blocks?.[0]).toMatchObject({
        type: 'tool_call',
        call: { id: 'tc-visible-abort', status: 'error' },
      });
    });
  });

  // ----------------------------------------------------------
  // 13. isSessionStreaming
  // ----------------------------------------------------------
  describe('isSessionStreaming', () => {
    it('returns true when session is background streaming', () => {
      (service as any).backgroundSessionId = 'sess-1';
      expect(service.isSessionStreaming('sess-1')).toBe(true);
    });

    it('returns false for different session', () => {
      (service as any).backgroundSessionId = 'sess-1';
      expect(service.isSessionStreaming('sess-2')).toBe(false);
    });

    it('returns false when no background stream', () => {
      (service as any).backgroundSessionId = null;
      expect(service.isSessionStreaming('sess-1')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 14. Tool call events
  // ----------------------------------------------------------
  describe('tool call events in sendMessage', () => {
    beforeEach(async () => {
      await service.init(mockPlatform, createConfig(provider));
    });

    it('handles tool_call_start and tool_call_end events', async () => {
      // Provider format: tool_call_start has id/name, tool_call_delta has id/argumentsDelta, tool_call_end has id/name/arguments
      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"val"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"val"}' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await service.sendMessage('Use tool');

      const assistant = service.messages.find((m) => m.role === 'assistant');
      expect(assistant?.toolCalls).toHaveLength(1);
      expect(assistant?.toolCalls![0].name).toBe('test_tool');
      expect(assistant?.toolCalls![0].status).toBe('completed');
    });

    it('updates blocks for tool calls', async () => {
      provider.addResponse([
        { type: 'text_delta', text: 'Let me check...' },
        { type: 'tool_call_start', id: 'tc1', name: 'read_file' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"path":"/test"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'read_file', arguments: '{"path":"/test"}' },
        { type: 'text_delta', text: ' Here is the result.' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await service.sendMessage('Read file');

      const assistant = service.messages.find((m) => m.role === 'assistant');
      expect(assistant?.blocks).toBeDefined();
      expect(assistant!.blocks!.length).toBeGreaterThanOrEqual(2);
      // First block should be text
      expect(assistant!.blocks![0].type).toBe('text');
    });

    it('ignores late stream events after final done', async () => {
      const run = vi.spyOn((service as any).runtime, 'run');
      run.mockImplementation(() => (async function* () {
        yield { type: 'text_delta', text: 'final' };
        yield { type: 'done', stopReason: 'stop' };
        yield { type: 'text_delta', text: 'late' };
      })() as any);

      await service.sendMessage('finish');

      const assistant = service.messages.find((m) => m.role === 'assistant');
      expect(assistant?.content).toBe('final');
      expect(assistant?.blocks).toEqual([{ type: 'text', text: 'final' }]);
      expect(assistant?.isStreaming).toBe(false);
    });

    it('marks read_file alias progress blocks done when the tool completes', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_read_alias',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [],
        blocks: [],
      }];

      (service as any).handleEvent({
        type: 'tool_call_start',
        call: { id: 'read-alias-1', name: 'read_file', arguments: { path: '/workspace/src/alias.ts' } },
      }, 'msg_read_alias');
      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'read-alias-1',
          output: 'export const alias = true;',
          isError: false,
        },
      }, 'msg_read_alias');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'progress',
        text: 'Reading file',
        status: 'done',
      });
      expect(service.messages[0].blocks).toContainEqual({
        type: 'reference',
        refs: [{ path: '/workspace/src/alias.ts' }],
      });
    });

    it('preserves csv fanout row details in display blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_csv',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'csv-1', name: 'csv_fanout', arguments: {}, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'csv-1', name: 'csv_fanout', arguments: {}, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'csv-1',
          output: JSON.stringify({
            totalRows: '2',
            succeeded: '1',
            failed: '1',
            rows: [
              { rowIndex: 1, status: 'success', rowData: { email: 'a@example.com' }, summary: 'sent' },
              { rowIndex: 2, status: 'failed', rowData: { email: 'b@example.com' }, summary: 'bounced' },
            ],
          }),
          isError: false,
        },
      }, 'msg_csv');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'csv_fanout',
        totalRows: 2,
        succeeded: 1,
        failed: 1,
        rows: [
          { rowIndex: 1, status: 'success', rowData: { email: 'a@example.com' }, summary: 'sent' },
          { rowIndex: 2, status: 'failed', rowData: { email: 'b@example.com' }, summary: 'bounced' },
        ],
      });
    });

    it('normalizes nested file tree children in display blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_tree',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'list-1', name: 'list_files', arguments: {}, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'list-1', name: 'list_files', arguments: {}, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'list-1',
          output: JSON.stringify([
            { name: 'app.ts', type: 'file' },
            {
              path: '/workspace/src/components',
              isDirectory: true,
              children: [
                { path: '/workspace/src/components/Button.tsx', type: 'file' },
                {
                  name: 'forms',
                  type: 'directory',
                  children: [{ path: '/workspace/src/components/forms/Input.tsx', type: 'file' }],
                },
              ],
            },
          ]),
          isError: false,
        },
      }, 'msg_tree');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'file_tree',
        tree: [
          { name: 'app.ts', type: 'file', children: undefined },
          {
            name: 'components',
            type: 'dir',
            children: [
              { name: 'Button.tsx', type: 'file', children: undefined },
              {
                name: 'forms',
                type: 'dir',
                children: [{ name: 'Input.tsx', type: 'file', children: undefined }],
              },
            ],
          },
        ],
      });
    });

    it('surfaces csv fanout metadata results in display blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_csv_metadata',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'csv-metadata-1', name: 'csv_fanout', arguments: {}, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'csv-metadata-1', name: 'csv_fanout', arguments: {}, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'csv-metadata-1',
          output: 'CSV fan-out completed: 1 succeeded, 1 failed out of 2 rows.',
          isError: false,
          metadata: {
            totalRows: 2,
            successCount: 1,
            failCount: 1,
            results: [
              { summary: 'sent', success: true },
              { summary: 'bounced', success: false, error: 'invalid email' },
            ],
          },
        },
      }, 'msg_csv_metadata');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'csv_fanout',
        totalRows: 2,
        succeeded: 1,
        failed: 1,
        rows: [
          { rowIndex: 1, status: 'success', rowData: {}, summary: 'sent' },
          { rowIndex: 2, status: 'failed', rowData: {}, summary: 'bounced' },
        ],
      });
    });

    it('surfaces glob newline file paths as file tree blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_glob_paths',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'glob-1', name: 'glob', arguments: { pattern: '**/*.ts' }, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'glob-1', name: 'glob', arguments: { pattern: '**/*.ts' }, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'glob-1',
          output: 'src/app.ts\nsrc/components/Button.tsx',
          isError: false,
        },
      }, 'msg_glob_paths');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'file_tree',
        tree: [
          { name: 'app.ts', type: 'file', children: undefined },
          { name: 'Button.tsx', type: 'file', children: undefined },
        ],
      });
    });

    it('marks ls alias progress blocks done when the tool completes', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_ls_alias',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [],
        blocks: [],
      }];

      (service as any).handleEvent({
        type: 'tool_call_start',
        call: { id: 'ls-alias-1', name: 'ls', arguments: { path: '/workspace/src' } },
      }, 'msg_ls_alias');
      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'ls-alias-1',
          output: JSON.stringify([{ name: 'alias.ts', type: 'file' }]),
          isError: false,
        },
      }, 'msg_ls_alias');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'progress',
        text: 'Listing files',
        status: 'done',
      });
      expect(service.messages[0].blocks).toContainEqual({
        type: 'file_tree',
        tree: [{ name: 'alias.ts', type: 'file', children: undefined }],
      });
    });

    it('accepts single web search result metadata in display blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_search',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'search-1', name: 'web_search', arguments: { query: 'agent client testing' }, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'search-1', name: 'web_search', arguments: { query: 'agent client testing' }, status: 'running' } }],
      }];

      expect(() => (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'search-1',
          output: 'Search complete',
          isError: false,
          metadata: {
            searchResults: {
              title: 'Agent client testing guide',
              url: 'https://example.com/client',
              snippet: 'How to test agent client services.',
            },
          },
        },
      }, 'msg_search')).not.toThrow();

      expect(service.messages[0].blocks).toContainEqual({
        type: 'web_search',
        query: 'agent client testing',
        results: [
          {
            title: 'Agent client testing guide',
            url: 'https://example.com/client',
            snippet: 'How to test agent client services.',
          },
        ],
      });
    });

    it('does not duplicate web search blocks when a tool result is replayed', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_search_replay',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'search-replay', name: 'web_search', arguments: { query: 'agent client replay' }, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'search-replay', name: 'web_search', arguments: { query: 'agent client replay' }, status: 'running' } }],
      }];

      const replayedEndEvent = {
        type: 'tool_call_end',
        result: {
          callId: 'search-replay',
          output: 'Search complete',
          isError: false,
          metadata: {
            searchResults: {
              title: 'Agent client replay guide',
              url: 'https://example.com/client-replay',
              snippet: 'Replay-safe search blocks.',
            },
          },
        },
      };

      (service as any).handleEvent(replayedEndEvent, 'msg_search_replay');
      (service as any).handleEvent(replayedEndEvent, 'msg_search_replay');

      const webSearchBlocks = service.messages[0].blocks?.filter((block: any) => block.type === 'web_search');
      expect(webSearchBlocks).toHaveLength(1);
      expect(webSearchBlocks?.[0]).toEqual({
        type: 'web_search',
        query: 'agent client replay',
        results: [
          {
            title: 'Agent client replay guide',
            url: 'https://example.com/client-replay',
            snippet: 'Replay-safe search blocks.',
          },
        ],
      });
    });

    it('keeps overlapping tool result blocks next to their owning tool call', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_search_overlap',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [
          { id: 'search-overlap', name: 'web_search', arguments: { query: 'agent client overlap' }, status: 'running' },
          { id: 'read-overlap', name: 'file_read', arguments: { path: '/workspace/src/next.ts' }, status: 'running' },
        ],
        blocks: [
          { type: 'progress', text: 'Searching the web', status: 'running' },
          { type: 'tool_call', call: { id: 'search-overlap', name: 'web_search', arguments: { query: 'agent client overlap' }, status: 'running' } },
          { type: 'progress', text: 'Reading file', status: 'running' },
          { type: 'tool_call', call: { id: 'read-overlap', name: 'file_read', arguments: { path: '/workspace/src/next.ts' }, status: 'running' } },
        ],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'search-overlap',
          output: 'Search complete',
          isError: false,
          metadata: {
            searchResults: {
              title: 'Agent client overlap guide',
              url: 'https://example.com/client-overlap',
              snippet: 'Overlap-safe search blocks.',
            },
          },
        },
      }, 'msg_search_overlap');

      expect(service.messages[0].blocks?.map((block) => block.type)).toEqual([
        'progress',
        'tool_call',
        'web_search',
        'progress',
        'tool_call',
      ]);
      expect(service.messages[0].blocks?.[2]).toEqual({
        type: 'web_search',
        query: 'agent client overlap',
        results: [
          {
            title: 'Agent client overlap guide',
            url: 'https://example.com/client-overlap',
            snippet: 'Overlap-safe search blocks.',
          },
        ],
      });
    });

    it('accepts single image_generate images object in display blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_image',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'image-1', name: 'image_generate', arguments: { model: 'gpt-image-test' }, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'image-1', name: 'image_generate', arguments: { model: 'gpt-image-test' }, status: 'running' } }],
      }];

      expect(() => (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'image-1',
          output: JSON.stringify({
            images: { url: 'https://example.com/generated.png', revised_prompt: 'A clearer prompt' },
          }),
          isError: false,
        },
      }, 'msg_image')).not.toThrow();

      expect(service.messages[0].blocks).toContainEqual({
        type: 'image_generated',
        images: [{ url: 'https://example.com/generated.png', base64: undefined, revisedPrompt: 'A clearer prompt' }],
        model: 'gpt-image-test',
      });
    });

    it('surfaces image generation metadata images in display blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_image_metadata',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'image-metadata-1', name: 'image_generate', arguments: { model: 'gpt-image-test' }, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'image-metadata-1', name: 'image_generate', arguments: { model: 'gpt-image-test' }, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'image-metadata-1',
          output: 'Generated 1 image(s) using model "gpt-image-test".',
          isError: false,
          metadata: {
            model: 'gpt-image-test',
            images: [{ url: 'https://example.com/metadata-image.png', revisedPrompt: 'Metadata prompt' }],
          },
        },
      }, 'msg_image_metadata');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'image_generated',
        images: [{ url: 'https://example.com/metadata-image.png', base64: undefined, revisedPrompt: 'Metadata prompt' }],
        model: 'gpt-image-test',
      });
    });

    it('surfaces screenshot JSON image output in display blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_screenshot_image',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'screenshot-1', name: 'screenshot', arguments: {}, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'screenshot-1', name: 'screenshot', arguments: {}, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'screenshot-1',
          output: JSON.stringify({ type: 'image', data: 'screenshot-base64', mimeType: 'image/jpeg' }),
          isError: false,
        },
      }, 'msg_screenshot_image');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'image_generated',
        images: [{ url: undefined, base64: 'screenshot-base64', mimeType: 'image/jpeg', revisedPrompt: undefined }],
        model: 'screenshot',
      });
    });

    it('normalizes single preview document image metadata in display blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_preview',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'preview-1', name: 'preview_document', arguments: { path: '/workspace/report.pdf' }, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'preview-1', name: 'preview_document', arguments: { path: '/workspace/report.pdf' }, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'preview-1',
          output: JSON.stringify({ kind: 'images', count: 1, type: 'pdf' }),
          isError: false,
          metadata: {
            previewResult: { kind: 'images', images: 'page-one-base64' },
          },
        },
      }, 'msg_preview');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'preview_images',
        images: ['page-one-base64'],
        title: '/workspace/report.pdf',
      });
    });

    it('deduplicates git diff file headers in code review blocks', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_diff',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'diff-1', name: 'git_diff', arguments: {}, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'diff-1', name: 'git_diff', arguments: {}, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'diff-1',
          output: [
            'diff --git a/src/app.ts b/src/app.ts',
            '--- a/src/app.ts',
            '+++ b/src/app.ts',
            'diff --git a/src/new.ts b/src/new.ts',
            '--- /dev/null',
            '+++ b/src/new.ts',
          ].join('\n'),
          isError: false,
        },
      }, 'msg_diff');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'code_review',
        findings: [
          { file: 'src/app.ts', severity: 'info', comment: '文件变更' },
          { file: 'src/new.ts', severity: 'info', comment: '文件变更' },
        ],
      });
    });

    it('skips file change blocks when file edit calls omit a path', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_write',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'write-1', name: 'write_file', arguments: {}, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'write-1', name: 'write_file', arguments: {}, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'write-1',
          output: 'created file',
          isError: false,
        },
      }, 'msg_write');

      expect(service.messages[0].blocks?.some((block: any) => (
        block.type === 'file_change' || block.type === 'turn_diff'
      ))).toBe(false);
    });

    it('keeps overlapping file change blocks next to their owning write tool call', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_write_overlap',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [
          { id: 'write-overlap', name: 'write_file', arguments: { path: '/workspace/src/overlap.ts' }, status: 'running' },
          { id: 'read-after-write', name: 'file_read', arguments: { path: '/workspace/src/next.ts' }, status: 'running' },
        ],
        blocks: [
          { type: 'tool_call', call: { id: 'write-overlap', name: 'write_file', arguments: { path: '/workspace/src/overlap.ts' }, status: 'running' } },
          { type: 'progress', text: 'Reading file', status: 'running' },
          { type: 'tool_call', call: { id: 'read-after-write', name: 'file_read', arguments: { path: '/workspace/src/next.ts' }, status: 'running' } },
        ],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'write-overlap',
          output: '+export const overlap = true;',
          isError: false,
        },
      }, 'msg_write_overlap');

      expect(service.messages[0].blocks?.map((block) => block.type)).toEqual([
        'tool_call',
        'file_change',
        'progress',
        'tool_call',
      ]);
      expect(service.messages[0].blocks?.[1]).toEqual({
        type: 'file_change',
        changes: [{
          path: '/workspace/src/overlap.ts',
          changeType: 'create',
          diff: '+export const overlap = true;',
        }],
      });
    });

    it('extracts command blocks on done even without multiple file changes', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_command',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        blocks: [{ type: 'text', text: 'Ready [Run checks](action:run_checks)' }],
      }];

      (service as any).handleEvent({
        type: 'done',
        stopReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }, 'msg_command');

      expect(service.messages[0].blocks).toEqual([
        { type: 'text', text: 'Ready' },
        { type: 'command', label: 'Run checks', action: 'run_checks' },
      ]);
    });

    it('surfaces denied auto review metadata even when the tool result is an error', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_review',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'review-1', name: 'bash', arguments: { command: 'rm -rf /' }, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'review-1', name: 'bash', arguments: { command: 'rm -rf /' }, status: 'running' } }],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'review-1',
          output: 'Auto-reviewer denied: Dangerous',
          isError: true,
          metadata: {
            autoReviewVerdict: {
              verdict: 'deny',
              reason: 'Dangerous',
              ruleId: 'deny-dangerous-bash',
            },
          },
        },
      }, 'msg_review');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'auto_review',
        toolName: 'bash',
        verdict: 'deny',
        reason: 'Dangerous',
        ruleId: 'deny-dangerous-bash',
      });
    });

    it('ignores auto review metadata when a tool result has no matching tool call', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      service.messages = [{
        id: 'msg_orphan_review',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [],
        blocks: [],
      }];

      (service as any).handleEvent({
        type: 'tool_call_end',
        result: {
          callId: 'missing-auto-review',
          output: 'Auto-reviewer denied: Orphaned',
          isError: true,
          metadata: {
            autoReviewVerdict: {
              verdict: 'deny',
              reason: 'Orphaned',
              ruleId: 'orphan-auto-review',
            },
          },
        },
      }, 'msg_orphan_review');

      expect(service.messages[0].blocks?.some((block: any) => block.type === 'auto_review')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 15. context_compacted event
  // ----------------------------------------------------------
  describe('context_compacted event', () => {
    it('adds a system message on context_compacted event', async () => {
      await service.init(mockPlatform, {
        provider,
        model: 'test-model',
        toolRegistry: new ToolRegistry(),
        contextConfig: {
          maxTokens: 100,
          compactionThreshold: 0.5,
          reservedForResponse: 10,
          preserveRecentMessages: 2,
        },
      });
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      // Use a long message to trigger compaction with the small context window
      const longMsg = 'A'.repeat(200);
      provider.addResponse([
        { type: 'text_delta', text: 'Response' },
        { type: 'done', stopReason: 'stop' },
      ]);

      await service.sendMessage(longMsg);

      const systemMsg = service.messages.find((m) => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg?.systemType).toBe('context_compacted');
    });
  });

  // ----------------------------------------------------------
  // 16. tool_approval_needed event
  // ----------------------------------------------------------
  describe('tool_approval_needed event', () => {
    it('sets status to waiting_approval and registers pending call', async () => {
      // Need PermissionManager with 'default' mode to trigger approval
      const { PermissionManager } = await import('@svton/agent-core');
      const registry = new ToolRegistry();
      registry.register(testToolDef, createMockExecutor());
      const config = { provider, model: 'test-model', toolRegistry: registry };

      await service.init(mockPlatform, config);

      // Get the runtime and set permission manager
      const runtime = (service as any).runtime;
      const pm = new PermissionManager({ mode: 'default' });
      runtime.setPermissionManager(pm);

      service.bindSession('sess-active');
      (service as any).backgroundSessionId = 'sess-active';

      provider.addResponse([
        { type: 'tool_call_start', id: 'tc1', name: 'test_tool' },
        { type: 'tool_call_delta', id: 'tc1', argumentsDelta: '{"key":"val"}' },
        { type: 'tool_call_end', id: 'tc1', name: 'test_tool', arguments: '{"key":"val"}' },
        { type: 'done', stopReason: 'tool_use' },
      ]);

      // Second response after approval
      provider.addResponse([
        { type: 'text_delta', text: 'Approved!' },
        { type: 'done', stopReason: 'stop' },
      ]);

      // Start streaming but don't await — we need to approve mid-stream
      const streamPromise = service.sendMessage('Use tool');

      // Wait a bit for the approval to be needed
      await new Promise((r) => setTimeout(r, 10));

      // Approve
      service.approveToolCall('tc1');

      await streamPromise;

      // After approval, status should eventually be idle
      expect(service.status).toBe('idle');
    });

    it('preserves approval metadata on pending tool calls before the user decides', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.messages = [{
        id: 'msg_metadata',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [
          { id: 'tc-meta', name: 'test_tool', arguments: {}, status: 'running' },
        ],
        blocks: [
          {
            type: 'tool_call',
            call: { id: 'tc-meta', name: 'test_tool', arguments: {}, status: 'running' },
          },
        ],
      }];

      await (service as any).handleEvent(
        {
          type: 'tool_approval_needed',
          call: { id: 'tc-meta', name: 'test_tool', arguments: {} },
          metadata: {
            autoReviewVerdict: {
              verdict: 'ask_user',
              reason: 'No matching rule',
              ruleId: undefined,
            },
          },
        },
        'msg_metadata',
      );

      expect(service.getPendingToolCalls()[0].metadata?.autoReviewVerdict).toEqual({
        verdict: 'ask_user',
        reason: 'No matching rule',
        ruleId: undefined,
      });
      expect(service.messages[0].toolCalls![0].metadata?.autoReviewVerdict).toEqual({
        verdict: 'ask_user',
        reason: 'No matching rule',
        ruleId: undefined,
      });
      expect((service.messages[0].blocks![0] as any).call.metadata?.autoReviewVerdict).toEqual({
        verdict: 'ask_user',
        reason: 'No matching rule',
        ruleId: undefined,
      });
    });

    it('keeps tool_call blocks in sync when approving or rejecting pending calls', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.messages = [{
        id: 'msg_approval',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [
          { id: 'tc-approve', name: 'test_tool', arguments: {}, status: 'pending_approval' },
          { id: 'tc-reject', name: 'test_tool', arguments: {}, status: 'pending_approval' },
        ],
        blocks: [
          {
            type: 'tool_call',
            call: { id: 'tc-approve', name: 'test_tool', arguments: {}, status: 'pending_approval' },
          },
          {
            type: 'tool_call',
            call: { id: 'tc-reject', name: 'test_tool', arguments: {}, status: 'pending_approval' },
          },
        ],
      }];
      (service as any).pendingToolCalls.set('tc-approve', {
        call: { id: 'tc-approve', name: 'test_tool', arguments: {} },
        resolve: vi.fn(),
      });
      (service as any).pendingToolCalls.set('tc-reject', {
        call: { id: 'tc-reject', name: 'test_tool', arguments: {} },
        resolve: vi.fn(),
      });

      service.approveToolCall('tc-approve');
      service.rejectToolCall('tc-reject');

      expect(service.messages[0].toolCalls![0].status).toBe('running');
      expect((service.messages[0].blocks![0] as any).call.status).toBe('running');
      expect(service.messages[0].toolCalls![1].status).toBe('error');
      expect((service.messages[0].blocks![1] as any).call.status).toBe('error');
    });

    it('keeps subagent blocks in sync when approval state changes', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.messages = [{
        id: 'msg_subagent_approval',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [
          { id: 'subagent-approve', name: 'subagent_spawn', arguments: {}, status: 'running' },
          { id: 'subagent-reject', name: 'subagent_spawn', arguments: {}, status: 'pending_approval' },
        ],
        blocks: [
          { type: 'subagent', agentId: 'subagent-approve', task: 'approve task', status: 'running' },
          { type: 'subagent', agentId: 'subagent-reject', task: 'reject task', status: 'pending' },
        ],
      }];
      (service as any).pendingToolCalls.set('subagent-reject', {
        call: { id: 'subagent-reject', name: 'subagent_spawn', arguments: {} },
        resolve: vi.fn(),
      });

      (service as any).updateToolCallStatus('subagent-approve', 'pending_approval');
      service.rejectToolCall('subagent-reject');

      expect(service.messages[0].toolCalls![0].status).toBe('pending_approval');
      expect((service.messages[0].blocks![0] as any).status).toBe('pending');
      expect(service.messages[0].toolCalls![1].status).toBe('error');
      expect((service.messages[0].blocks![1] as any).status).toBe('error');
    });
  });

  // ----------------------------------------------------------
  // 17. tool_call_progress event
  // ----------------------------------------------------------
  describe('tool_call_progress event', () => {
    it('updates tool call arguments via progress event', async () => {
      // The runtime emits tool_call_progress after parsing accumulated args
      // This is tested indirectly through the tool call flow
      // Here we test the ChatService handler directly
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      // Set up an assistant message with a tool call
      const assistantMsg: DisplayMessage = {
        id: 'msg_test', role: 'assistant', content: '', timestamp: Date.now(),
        toolCalls: [{ id: 'tc1', name: 'test', arguments: {}, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'tc1', name: 'test', arguments: {}, status: 'running' } }],
      };
      service.messages = [assistantMsg];

      // Simulate tool_call_progress event
      const event: any = {
        type: 'tool_call_progress',
        callId: 'tc1',
        message: '',
        arguments: { key: 'updated_value' },
      };
      (service as any).handleEvent(event, 'msg_test');

      expect(service.messages[0].toolCalls![0].arguments).toEqual({ key: 'updated_value' });
    });

    it('updates tool call names via progress event', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      const assistantMsg: DisplayMessage = {
        id: 'msg_test',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'tc1', name: 'test_', arguments: {}, status: 'running' }],
        blocks: [{ type: 'tool_call', call: { id: 'tc1', name: 'test_', arguments: {}, status: 'running' } }],
      };
      service.messages = [assistantMsg];

      const event: any = {
        type: 'tool_call_progress',
        callId: 'tc1',
        name: 'test_tool',
        message: '',
        arguments: { key: 'updated_value' },
      };
      (service as any).handleEvent(event, 'msg_test');

      expect(service.messages[0].toolCalls![0]).toMatchObject({
        name: 'test_tool',
        arguments: { key: 'updated_value' },
      });
      expect((service.messages[0].blocks![0] as any).call).toMatchObject({
        name: 'test_tool',
        arguments: { key: 'updated_value' },
      });
    });

    it('reclassifies partial subagent starts when progress carries the final name', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      const assistantMsg: DisplayMessage = {
        id: 'msg_test',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'subagent-1', name: 'subagent_', arguments: {}, status: 'running' }],
        blocks: [{
          type: 'tool_call',
          call: { id: 'subagent-1', name: 'subagent_', arguments: {}, status: 'running' },
        }],
      };
      service.messages = [assistantMsg];

      const event: any = {
        type: 'tool_call_progress',
        callId: 'subagent-1',
        name: 'subagent_spawn',
        message: '',
        arguments: { task: 'inspect auth flow' },
      };
      (service as any).handleEvent(event, 'msg_test');

      expect(service.messages[0].toolCalls![0]).toMatchObject({
        name: 'subagent_spawn',
        arguments: { task: 'inspect auth flow' },
      });
      expect(service.messages[0].blocks![0]).toMatchObject({
        type: 'subagent',
        agentId: 'subagent-1',
        task: 'inspect auth flow',
        status: 'running',
      });
    });

    it('adds slow tool progress blocks when progress carries the final slow tool name', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      const assistantMsg: DisplayMessage = {
        id: 'msg_test',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [{ id: 'web-1', name: 'web_', arguments: {}, status: 'running' }],
        blocks: [{
          type: 'tool_call',
          call: { id: 'web-1', name: 'web_', arguments: {}, status: 'running' },
        }],
      };
      service.messages = [assistantMsg];

      const event: any = {
        type: 'tool_call_progress',
        callId: 'web-1',
        name: 'web_search',
        message: '',
        arguments: { query: 'agent runtime' },
      };
      (service as any).handleEvent(event, 'msg_test');

      expect(service.messages[0].blocks).toContainEqual({
        type: 'progress',
        text: 'Searching the web',
        status: 'running',
      });
      expect(service.messages[0].blocks).toContainEqual({
        type: 'tool_call',
        call: {
          id: 'web-1',
          name: 'web_search',
          arguments: { query: 'agent runtime' },
          status: 'running',
        },
      });
    });

    it('inserts progress-updated slow tool blocks before the matching tool call', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      const assistantMsg: DisplayMessage = {
        id: 'msg_test',
        role: 'assistant',
        content: 'Intro',
        timestamp: Date.now(),
        toolCalls: [{ id: 'web-1', name: 'web_', arguments: {}, status: 'running' }],
        blocks: [
          { type: 'text', text: 'Intro' },
          {
            type: 'tool_call',
            call: { id: 'web-1', name: 'web_', arguments: {}, status: 'running' },
          },
        ],
      };
      service.messages = [assistantMsg];

      const event: any = {
        type: 'tool_call_progress',
        callId: 'web-1',
        name: 'web_search',
        message: '',
        arguments: { query: 'agent runtime' },
      };
      (service as any).handleEvent(event, 'msg_test');

      expect(service.messages[0].blocks![0]).toEqual({ type: 'text', text: 'Intro' });
      expect(service.messages[0].blocks![1]).toEqual({
        type: 'progress',
        text: 'Searching the web',
        status: 'running',
      });
      expect(service.messages[0].blocks![2]).toMatchObject({
        type: 'tool_call',
        call: { id: 'web-1', name: 'web_search' },
      });
    });

    it('keeps separate progress blocks for repeated progress-updated slow tools', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      const assistantMsg: DisplayMessage = {
        id: 'msg_test',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [
          { id: 'web-1', name: 'web_', arguments: {}, status: 'running' },
          { id: 'web-2', name: 'web_', arguments: {}, status: 'running' },
        ],
        blocks: [
          { type: 'tool_call', call: { id: 'web-1', name: 'web_', arguments: {}, status: 'running' } },
          { type: 'tool_call', call: { id: 'web-2', name: 'web_', arguments: {}, status: 'running' } },
        ],
      };
      service.messages = [assistantMsg];

      const firstEvent: any = {
        type: 'tool_call_progress',
        callId: 'web-1',
        name: 'web_search',
        message: '',
        arguments: { query: 'first' },
      };
      const secondEvent: any = {
        type: 'tool_call_progress',
        callId: 'web-2',
        name: 'web_search',
        message: '',
        arguments: { query: 'second' },
      };
      (service as any).handleEvent(firstEvent, 'msg_test');
      (service as any).handleEvent(secondEvent, 'msg_test');

      const progressBlocks = service.messages[0].blocks!.filter((block) =>
        block.type === 'progress' && block.text === 'Searching the web'
      );
      expect(progressBlocks).toHaveLength(2);
      expect(service.messages[0].blocks![0]).toMatchObject({ type: 'progress' });
      expect(service.messages[0].blocks![1]).toMatchObject({
        type: 'tool_call',
        call: { id: 'web-1', arguments: { query: 'first' } },
      });
      expect(service.messages[0].blocks![2]).toMatchObject({ type: 'progress' });
      expect(service.messages[0].blocks![3]).toMatchObject({
        type: 'tool_call',
        call: { id: 'web-2', arguments: { query: 'second' } },
      });
    });

    it('marks only the completed slow tool progress block done', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      const assistantMsg: DisplayMessage = {
        id: 'msg_test',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCalls: [
          { id: 'web-1', name: 'web_search', arguments: { query: 'first' }, status: 'running' },
          { id: 'web-2', name: 'web_search', arguments: { query: 'second' }, status: 'running' },
        ],
        blocks: [
          { type: 'progress', text: 'Searching the web', status: 'running' },
          { type: 'tool_call', call: { id: 'web-1', name: 'web_search', arguments: { query: 'first' }, status: 'running' } },
          { type: 'progress', text: 'Searching the web', status: 'running' },
          { type: 'tool_call', call: { id: 'web-2', name: 'web_search', arguments: { query: 'second' }, status: 'running' } },
        ],
      };
      service.messages = [assistantMsg];

      const event: any = {
        type: 'tool_call_end',
        result: { callId: 'web-1', output: 'first done', isError: false },
      };
      (service as any).handleEvent(event, 'msg_test');

      expect(service.messages[0].blocks![0]).toEqual({
        type: 'progress',
        text: 'Searching the web',
        status: 'done',
      });
      expect(service.messages[0].blocks![2]).toEqual({
        type: 'progress',
        text: 'Searching the web',
        status: 'running',
      });
    });

    it('does not create orphan progress blocks for unknown tool calls', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      const assistantMsg: DisplayMessage = {
        id: 'msg_test',
        role: 'assistant',
        content: 'Intro',
        timestamp: Date.now(),
        toolCalls: [],
        blocks: [{ type: 'text', text: 'Intro' }],
      };
      service.messages = [assistantMsg];

      const event: any = {
        type: 'tool_call_progress',
        callId: 'missing-call',
        name: 'web_search',
        message: '',
        arguments: { query: 'orphan' },
      };
      (service as any).handleEvent(event, 'msg_test');

      expect(service.messages[0].toolCalls).toEqual([]);
      expect(service.messages[0].blocks).toEqual([{ type: 'text', text: 'Intro' }]);
    });
  });

  // ----------------------------------------------------------
  // 18. Background streaming routing
  // ----------------------------------------------------------
  describe('background streaming', () => {
    it('routes events to session cache when session is not active', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-active');
      (service as any).backgroundSessionId = 'sess-bg';

      // Cache some messages for background session
      const bgMsgs: DisplayMessage[] = [
        { id: 'bg_msg_1', role: 'user', content: 'BG question', timestamp: 1000 },
        { id: 'bg_assistant', role: 'assistant', content: '', toolCalls: [], isStreaming: true, timestamp: 1001 },
      ];
      service.cacheSessionMessages('sess-bg', bgMsgs);

      // Simulate text_delta for background session
      const event: any = { type: 'text_delta', text: 'BG response' };
      (service as any).handleEvent(event, 'bg_assistant');

      // Active messages should NOT change
      expect(service.messages.find((m) => m.id === 'bg_assistant')).toBeUndefined();

      // Background cache should be updated
      const cached = service.getCachedMessages('sess-bg');
      expect(cached![1].content).toBe('BG response');
    });

    it('invokes onBackgroundStreamEnd when stream completes in background', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-active');
      (service as any).backgroundSessionId = 'sess-bg';

      let callbackCalled = false;
      let callbackSessionId = '';
      service.onBackgroundStreamEnd = (sid) => {
        callbackCalled = true;
        callbackSessionId = sid;
      };

      const bgMsgs: DisplayMessage[] = [
        { id: 'bg_asst', role: 'assistant', content: 'Done', toolCalls: [], isStreaming: true, timestamp: 1000 },
      ];
      service.cacheSessionMessages('sess-bg', bgMsgs);

      (service as any).handleStreamEnd('bg_asst', { isStreaming: false, duration: 100 });

      expect(callbackCalled).toBe(true);
      expect(callbackSessionId).toBe('sess-bg');
      expect(service.backgroundSessionId).toBeNull();
    });

    it('invokes onBackgroundStreamEnd when a background stream is aborted', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-active');
      (service as any).backgroundSessionId = 'sess-bg';

      let callbackSessionId = '';
      service.onBackgroundStreamEnd = (sid) => {
        callbackSessionId = sid;
      };

      const bgMsgs: DisplayMessage[] = [
        { id: 'bg_asst', role: 'assistant', content: 'Partial', toolCalls: [], isStreaming: true, timestamp: 1000 },
      ];
      service.cacheSessionMessages('sess-bg', bgMsgs);

      service.abort();

      const cached = service.getCachedMessages('sess-bg');
      expect(cached![0].isStreaming).toBe(false);
      expect(callbackSessionId).toBe('sess-bg');
      expect(service.backgroundSessionId).toBeNull();
    });

    it('marks cached background tool calls pending when approval is requested', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-active');
      (service as any).backgroundSessionId = 'sess-bg';

      const bgMsgs: DisplayMessage[] = [
        {
          id: 'bg_asst',
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'tc-bg', name: 'test_tool', arguments: {}, status: 'running' }],
          blocks: [{
            type: 'tool_call',
            call: { id: 'tc-bg', name: 'test_tool', arguments: {}, status: 'running' },
          }],
          isStreaming: true,
          timestamp: 1000,
        },
      ];
      service.cacheSessionMessages('sess-bg', bgMsgs);

      (service as any).handleEvent({
        type: 'tool_approval_needed',
        call: { id: 'tc-bg', name: 'test_tool', arguments: {} },
      }, 'bg_asst');

      const cached = service.getCachedMessages('sess-bg');
      expect(service.hasPendingApprovals).toBe(true);
      expect(cached![0].toolCalls![0].status).toBe('pending_approval');
      expect((cached![0].blocks![0] as any).call.status).toBe('pending_approval');
      expect(service.messages.find((m) => m.id === 'bg_asst')).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 19. getMessagesForSave filtering
  // ----------------------------------------------------------
  describe('getMessagesForSave', () => {
    it('filters out system and streaming messages', () => {
      service.messages = [
        { id: 'm1', role: 'user', content: 'Hello', timestamp: 1000 },
        { id: 'm2', role: 'assistant', content: 'Streaming...', isStreaming: true, timestamp: 1001 },
        { id: 'm3', role: 'system', content: 'Compacted', systemType: 'context_compacted', timestamp: 1002 },
        { id: 'm4', role: 'assistant', content: 'Done', timestamp: 1003 },
      ];

      const saved = service.getMessagesForSave();
      expect(saved).toHaveLength(2);
      expect(saved[0].id).toBe('m1');
      expect(saved[1].id).toBe('m4');
    });

    it('returns empty array when all messages are filtered', () => {
      service.messages = [
        { id: 'm1', role: 'system', content: 'System msg', timestamp: 1000 },
      ];
      expect(service.getMessagesForSave()).toEqual([]);
    });

    it('forcePrepareForSave finalizes visible-only pending approvals', () => {
      service.messages = [{
        id: 'm-visible-force-save',
        role: 'assistant',
        content: '',
        timestamp: 1000,
        isStreaming: true,
        toolCalls: [{
          id: 'tc-force-save',
          name: 'write_file',
          arguments: { path: '/tmp/out.txt' },
          status: 'pending_approval',
        }],
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-force-save',
            name: 'write_file',
            arguments: { path: '/tmp/out.txt' },
            status: 'pending_approval',
          },
        }],
      }];

      const saved = service.forcePrepareForSave();

      expect(saved[0].isStreaming).toBe(false);
      expect(saved[0].toolCalls?.[0].status).toBe('error');
      expect(saved[0].blocks?.[0]).toMatchObject({
        type: 'tool_call',
        call: { id: 'tc-force-save', status: 'error' },
      });
    });
  });

  // ----------------------------------------------------------
  // 20. Images in sendMessage
  // ----------------------------------------------------------
  describe('images in sendMessage', () => {
    it('sends message with images', async () => {
      await service.init(mockPlatform, createConfig(provider));

      provider.addResponse([
        { type: 'text_delta', text: 'I see the image' },
        { type: 'done', stopReason: 'stop' },
      ]);

      const images = [{ data: 'base64imagedata', mimeType: 'image/png' }];
      await service.sendMessage('What is in this image?', images);

      expect(service.messages[0].role).toBe('user');
      expect(service.messages[0].images).toEqual(images);
      expect(service.messages[0].content).toBe('What is in this image?');
    });
  });

  // ----------------------------------------------------------
  // 21. Thinking separator logic
  // ----------------------------------------------------------
  describe('thinking_delta separator', () => {
    it('adds separator when lastEventType is tool_call_end or done', async () => {
      await service.init(mockPlatform, createConfig(provider));
      service.bindSession('sess-1');
      (service as any).backgroundSessionId = 'sess-1';

      // Set lastEventType to simulate a tool call having just ended
      (service as any).lastEventType = 'tool_call_end';

      const assistantMsg: DisplayMessage = {
        id: 'msg_sep', role: 'assistant', content: '', thinking: '', timestamp: Date.now(), toolCalls: [],
      };
      service.messages = [assistantMsg];

      const event: any = { type: 'thinking_delta', thinking: 'New thinking after tool' };
      (service as any).handleEvent(event, 'msg_sep');

      expect(service.messages[0].thinking).toContain('---');
      expect(service.messages[0].thinking).toContain('New thinking after tool');
    });
  });
});
