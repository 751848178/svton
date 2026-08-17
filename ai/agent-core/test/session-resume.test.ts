import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionResumeManager } from '@svton/agent-core';
import { cloneSecretSafeMessages } from '../src/checkpoint/checkpoint-secret-safe-clone';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { UserMessage } from '@earendil-works/pi-ai';
import type { IStorage } from '@svton/agent-platform';
import type { ReasoningEffort } from '@svton/agent-core';

// ==============================================================
// Mock Helpers
// ==============================================================

class MockStorage implements IStorage {
  private map = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return (this.map.get(key) ?? null) as T | null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = [...this.map.keys()];
    if (!prefix) return keys;
    return keys.filter((k) => k.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.map.clear();
  }
}

/**
 * Minimal SvtonAgentRuntime stub.
 * SessionResumeManager calls: getMessages(), getReasoningEffort(),
 * setMessages(), setReasoningEffort(), and getModel() (PI003 replaced the
 * unsafe `(runtime as any).model` cast with a clean accessor).
 */
function createMockRuntime(messages: AgentMessage[] = []) {
  let currentMessages = [...messages];
  let currentEffort: ReasoningEffort | undefined;

  return {
    model: 'test-model',
    getModel: vi.fn(() => 'test-model'),
    getMessages: vi.fn(() => currentMessages),
    getReasoningEffort: vi.fn(() => currentEffort),
    reset: vi.fn(() => {
      currentMessages = [];
    }),
    setMessages: vi.fn((msgs: AgentMessage[]) => {
      currentMessages = msgs;
    }),
    setReasoningEffort: vi.fn((effort: ReasoningEffort | undefined) => {
      currentEffort = effort;
    }),
  };
}

const sampleUserMessage: UserMessage = {
  role: 'user',
  content: 'Hello',
  timestamp: 1,
};
const sampleMessages: AgentMessage[] = [
  sampleUserMessage,
  {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Hi there', textSignature: 'text-signature' },
      {
        type: 'thinking',
        thinking: 'private reasoning',
        thinkingSignature: 'thinking-signature',
        redacted: true,
      },
      {
        type: 'toolCall',
        id: 'call-1',
        name: 'search',
        arguments: { query: 'pi' },
        thoughtSignature: 'tool-thought-signature',
      },
    ],
    api: 'openai-completions',
    provider: 'openai',
    model: 'gpt-test',
    responseModel: 'gpt-test-2026',
    responseId: 'response-1',
    usage: {
      input: 11,
      output: 12,
      cacheRead: 13,
      cacheWrite: 14,
      totalTokens: 50,
      cost: {
        input: 1,
        output: 2,
        cacheRead: 3,
        cacheWrite: 4,
        total: 10,
      },
    },
    stopReason: 'toolUse',
    timestamp: 2,
  },
  {
    role: 'toolResult',
    toolCallId: 'call-1',
    toolName: 'search',
    content: [
      { type: 'text', text: 'result', textSignature: 'result-signature' },
      { type: 'image', data: 'base64-image', mimeType: 'image/png' },
    ],
    details: { source: 'fixture', nested: { preserved: true } },
    usage: {
      input: 1,
      output: 2,
      cacheRead: 3,
      cacheWrite: 4,
      totalTokens: 10,
      cost: {
        input: 0.1,
        output: 0.2,
        cacheRead: 0.3,
        cacheWrite: 0.4,
        total: 1,
      },
    },
    addedToolNames: ['follow_up'],
    isError: false,
    timestamp: 3,
  },
];

// ==============================================================
// Tests
// ==============================================================

describe('F2 — Session Resume (SessionResumeManager)', () => {
  let storage: MockStorage;
  let manager: SessionResumeManager;

  beforeEach(() => {
    storage = new MockStorage();
    manager = new SessionResumeManager(storage);
  });

  // ----------------------------------------------------------
  // checkpoint()
  // ----------------------------------------------------------
  describe('checkpoint()', () => {
    it('saves serialized runtime state to storage', async () => {
      const runtime = createMockRuntime(sampleMessages);

      await manager.checkpoint('sess-1', runtime as any);

      const raw = await storage.get<string>('agent:checkpoint:sess-1');
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(parsed.messages).toStrictEqual(sampleMessages);
      expect(parsed.model).toBe('test-model');
      expect(typeof parsed.updatedAt).toBe('number');
    });

    it('records reasoningEffort when set on the runtime', async () => {
      const runtime = createMockRuntime(sampleMessages);
      runtime.getReasoningEffort.mockReturnValue('high');

      await manager.checkpoint('sess-1', runtime as any);

      const raw = await storage.get<string>('agent:checkpoint:sess-1');
      const parsed = JSON.parse(raw!);
      expect(parsed.reasoningEffort).toBe('high');
    });

    it('does not throw if the runtime has an empty message list', async () => {
      const runtime = createMockRuntime([]);

      await manager.checkpoint('empty-sess', runtime as any);

      const raw = await storage.get<string>('agent:checkpoint:empty-sess');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.messages).toEqual([]);
    });

    it('persists a secret-safe clone and restores it without mutating live messages', async () => {
      const rawApiKey = 'raw-api-key-checkpoint';
      const rawPassword = 'raw-password-checkpoint';
      const opaqueSignature = 'eyJabcdefgh.eyJijklmnop.abcdefghijk';
      const opaqueImageData = `image-${opaqueSignature}`;
      const messages = structuredClone(sampleMessages);
      const assistant = messages[1] as Extract<AgentMessage, { role: 'assistant' }>;
      const call = assistant.content.find((item) => item.type === 'toolCall');
      if (!call || call.type !== 'toolCall') throw new Error('Missing tool call fixture');
      const cyclicArguments: Record<string, unknown> = {
        apiKey: rawApiKey,
        nested: { password: rawPassword },
        command: `deploy --password=${rawPassword}`,
        bigint: 42n,
      };
      cyclicArguments.self = cyclicArguments;
      call.arguments = cyclicArguments;
      call.thoughtSignature = opaqueSignature;
      const text = assistant.content.find((item) => item.type === 'text');
      const thinking = assistant.content.find((item) => item.type === 'thinking');
      if (text?.type === 'text') text.textSignature = opaqueSignature;
      if (thinking?.type === 'thinking') thinking.thinkingSignature = opaqueSignature;
      (assistant as unknown as Record<string, unknown>).errorMessage = undefined;
      (assistant as unknown as Record<string, unknown>).metadata = {
        password: 'meta-x', apiKey: 'meta-y', tokenCount: 4,
        providerBlob: opaqueSignature,
      };
      const toolResult = messages[2] as Extract<AgentMessage, { role: 'toolResult' }>;
      const toolDetails: Record<string, unknown> = {
        password: 'x', apiKey: 'y', tokenCount: 3, secretQuestionIds: ['q1'],
        stdout: `password=${rawPassword}`,
        command: 'deploy --token raw-command-secret',
        result: 'password=raw-result-secret',
        providerBlob: opaqueSignature,
      };
      toolDetails.self = toolDetails;
      toolResult.details = toolDetails;
      const image = toolResult.content.find((item) => item.type === 'image');
      if (image?.type === 'image') image.data = opaqueImageData;
      const runtime = createMockRuntime(messages);
      const safeClone = cloneSecretSafeMessages(messages);
      expect(findBigIntPaths(safeClone)).toEqual([]);
      expect(() => JSON.stringify(safeClone)).not.toThrow();

      await manager.checkpoint('secret-safe', runtime as any);

      const raw = await storage.get<string>('agent:checkpoint:secret-safe');
      expect(raw).not.toContain(rawApiKey);
      expect(raw).not.toContain(rawPassword);
      expect(raw).not.toContain('"password":"x"');
      expect(raw).not.toContain('"apiKey":"y"');
      expect(raw).not.toContain('meta-x');
      expect(raw).not.toContain('meta-y');
      expect(raw).not.toContain('raw-command-secret');
      expect(raw).not.toContain('raw-result-secret');
      expect(raw).toContain(opaqueSignature);
      expect(raw).toContain(opaqueImageData);
      expect(raw).toContain('"tokenCount":3');
      expect(raw).toContain('"tokenCount":4');
      expect(raw).toContain('"secretQuestionIds":["q1"]');
      expect(raw).toContain('[circular]');
      expect(await manager.load('secret-safe')).not.toBeNull();
      expect(call.arguments.apiKey).toBe(rawApiKey);
      expect(call.arguments.self).toBe(call.arguments);
      const restored = createMockRuntime([]);
      expect(await manager.restore('secret-safe', restored as any)).toBe(true);
      expect(JSON.stringify(restored.getMessages())).not.toContain(rawApiKey);
      expect(JSON.stringify(restored.getMessages())).not.toContain(rawPassword);
      expect(JSON.stringify(restored.getMessages())).toContain(opaqueSignature);
      expect(JSON.stringify(restored.getMessages())).toContain(opaqueImageData);
    });
  });

  // ----------------------------------------------------------
  // load()
  // ----------------------------------------------------------
  describe('load()', () => {
    it('returns the saved state', async () => {
      const runtime = createMockRuntime(sampleMessages);
      await manager.checkpoint('sess-load', runtime as any);

      const state = await manager.load('sess-load');

      expect(state).not.toBeNull();
      expect(state!.messages).toStrictEqual(sampleMessages);
      expect(state!.model).toBe('test-model');
    });

    it('accepts canonical toolUse and rejects noncanonical tool_use', async () => {
      const runtime = createMockRuntime(sampleMessages);
      await manager.checkpoint('tool-stop-reason', runtime as any);
      expect(await manager.load('tool-stop-reason')).not.toBeNull();

      const raw = await storage.get<string>('agent:checkpoint:tool-stop-reason');
      const malformed = JSON.parse(raw!);
      malformed.messages[1].stopReason = 'tool_use';
      await storage.set('agent:checkpoint:tool-stop-reason', JSON.stringify(malformed));

      expect(await manager.load('tool-stop-reason')).toBeNull();
    });

    it('returns null when no checkpoint exists', async () => {
      const state = await manager.load('nonexistent');
      expect(state).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // restore()
  // ----------------------------------------------------------
  describe('restore()', () => {
    it('sets messages on the runtime from the checkpoint', async () => {
      const runtime = createMockRuntime([]);
      await manager.checkpoint('sess-restore', createMockRuntime(sampleMessages) as any);

      const ok = await manager.restore('sess-restore', runtime as any);

      expect(ok).toBe(true);
      expect(runtime.reset).toHaveBeenCalledOnce();
      expect(runtime.setMessages).toHaveBeenCalledWith(sampleMessages);
    });

    it('sets reasoningEffort when the checkpoint includes it', async () => {
      // Save a checkpoint with effort
      const saveRt = createMockRuntime(sampleMessages);
      saveRt.getReasoningEffort.mockReturnValue('medium');
      await manager.checkpoint('sess-effort', saveRt as any);

      // Restore into a fresh runtime
      const restoreRt = createMockRuntime([]);

      await manager.restore('sess-effort', restoreRt as any);

      expect(restoreRt.setReasoningEffort).toHaveBeenCalledWith('medium');
    });

    it('returns false when no checkpoint is found', async () => {
      const runtime = createMockRuntime([]);

      const ok = await manager.restore('missing', runtime as any);

      expect(ok).toBe(false);
      expect(runtime.setMessages).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // delete()
  // ----------------------------------------------------------
  describe('delete()', () => {
    it('removes the checkpoint from storage', async () => {
      await manager.checkpoint('sess-del', createMockRuntime(sampleMessages) as any);

      // Confirm it exists
      expect(await manager.load('sess-del')).not.toBeNull();

      await manager.delete('sess-del');

      expect(await manager.load('sess-del')).toBeNull();
    });

    it('does not throw when deleting a non-existent checkpoint', async () => {
      await expect(manager.delete('nope')).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // listAll()
  // ----------------------------------------------------------
  describe('listAll()', () => {
    it('returns metadata for all checkpoints sorted newest first', async () => {
      const rt1 = createMockRuntime([{
        role: 'user',
        content: 'a',
        timestamp: 1,
      }]);
      const rt2 = createMockRuntime([{
        role: 'user',
        content: 'b',
        timestamp: 2,
      }]);

      await manager.checkpoint('sess-a', rt1 as any);
      // Small delay so updatedAt differs
      await new Promise((r) => setTimeout(r, 5));
      await manager.checkpoint('sess-b', rt2 as any);

      const all = await manager.listAll();

      expect(all).toHaveLength(2);
      expect(all[0].updatedAt).toBeGreaterThanOrEqual(all[1].updatedAt);
      expect(all.map((m) => m.sessionId).sort()).toEqual(['sess-a', 'sess-b']);
    });

    it('returns empty array when no checkpoints exist', async () => {
      const all = await manager.listAll();
      expect(all).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // loadMeta()
  // ----------------------------------------------------------
  describe('loadMeta()', () => {
    it('returns metadata without the full message payload', async () => {
      await manager.checkpoint('sess-meta', createMockRuntime(sampleMessages) as any);

      const meta = await manager.loadMeta('sess-meta');

      expect(meta).not.toBeNull();
      expect(meta!.sessionId).toBe('sess-meta');
      expect(meta!.messageCount).toBe(3);
      expect(meta!.model).toBe('test-model');
    });

    it('returns null when checkpoint does not exist', async () => {
      const meta = await manager.loadMeta('missing');
      expect(meta).toBeNull();
    });
  });
});

function findBigIntPaths(value: unknown): string[] {
  const paths: string[] = [];
  const seen = new WeakSet<object>();
  function visit(item: unknown, path: string): void {
    if (typeof item === 'bigint') paths.push(path);
    if (!item || typeof item !== 'object' || seen.has(item)) return;
    seen.add(item);
    for (const [key, nested] of Object.entries(item)) visit(nested, `${path}.${key}`);
  }
  visit(value, 'root');
  return paths;
}
