import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionResumeManager } from '@svton/agent-core';
import type { IStorage } from '@svton/agent-platform';
import type { ChatMessage, ReasoningEffort } from '@svton/agent-core';

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
 * Minimal AgentRuntime stub.
 * SessionResumeManager calls: getMessages(), getReasoningEffort(),
 * setMessages(), setReasoningEffort(), and reads .model.
 */
function createMockRuntime(messages: ChatMessage[] = []) {
  let currentMessages = [...messages];
  let currentEffort: ReasoningEffort | undefined;

  return {
    model: 'test-model',
    getMessages: vi.fn(() => currentMessages),
    getReasoningEffort: vi.fn(() => currentEffort),
    setMessages: vi.fn((msgs: ChatMessage[]) => {
      currentMessages = msgs;
    }),
    setReasoningEffort: vi.fn((effort: ReasoningEffort | undefined) => {
      currentEffort = effort;
    }),
  };
}

const sampleMessages: ChatMessage[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there' },
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
      expect(parsed.messages).toEqual(sampleMessages);
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
      expect(state!.messages).toEqual(sampleMessages);
      expect(state!.model).toBe('test-model');
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
      const rt1 = createMockRuntime([{ role: 'user', content: 'a' }]);
      const rt2 = createMockRuntime([{ role: 'user', content: 'b' }]);

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
      expect(meta!.messageCount).toBe(2);
      expect(meta!.model).toBe('test-model');
    });

    it('returns null when checkpoint does not exist', async () => {
      const meta = await manager.loadMeta('missing');
      expect(meta).toBeNull();
    });
  });
});
