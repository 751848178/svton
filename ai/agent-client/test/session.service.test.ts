import { describe, it, expect, beforeEach } from 'vitest';
import 'reflect-metadata';
import { SessionService } from '../src/service/session.service';
import type { IStorage } from '@svton/agent-platform';

// ==============================================================
// In-memory IStorage mock
// ==============================================================

function createMockStorage(): IStorage {
  const store = new Map<string, unknown>();
  return {
    get: <T = unknown>(key: string) => Promise.resolve((store.get(key) ?? null) as T | null),
    set: <T = unknown>(key: string, value: T) => { store.set(key, value); return Promise.resolve(); },
    delete: (key: string) => { store.delete(key); return Promise.resolve(); },
    list: (prefix?: string) => {
      const keys = [...store.keys()];
      return Promise.resolve(prefix ? keys.filter((k) => k.startsWith(prefix)) : keys);
    },
    clear: () => { store.clear(); return Promise.resolve(); },
  };
}

// ==============================================================
// Tests
// ==============================================================

describe('SessionService', () => {
  let storage: IStorage;
  let service: SessionService;

  beforeEach(() => {
    storage = createMockStorage();
    service = new SessionService();
  });

  // ----------------------------------------------------------
  // 1. init
  // ----------------------------------------------------------
  describe('init', () => {
    it('initializes and sets ready=true', async () => {
      await service.init(storage);
      expect(service.ready).toBe(true);
    });

    it('loads an empty session list on first init', async () => {
      await service.init(storage);
      expect(service.sessions).toEqual([]);
      expect(service.currentSessionId).toBeNull();
    });

    it('skips re-initialization if already ready', async () => {
      await service.init(storage);
      service.currentSessionId = 'test-id';
      await service.init(storage);
      expect(service.currentSessionId).toBe('test-id');
    });

    it('loads existing sessions from storage', async () => {
      const existingList = [
        { id: 's1', title: 'Chat 1', model: 'gpt-4o', messageCount: 3, createdAt: 1000, updatedAt: 2000 },
        { id: 's2', title: 'Chat 2', model: 'gpt-4o', messageCount: 0, createdAt: 3000, updatedAt: 3000 },
      ];
      await storage.set('agent:session_list', existingList);
      await service.init(storage);
      expect(service.sessions).toHaveLength(2);
      expect(service.sessions[0].id).toBe('s1');
    });
  });

  // ----------------------------------------------------------
  // 2. create
  // ----------------------------------------------------------
  describe('create', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('creates a new session and sets it as current', async () => {
      const id = await service.create('My Chat', 'gpt-4o');
      expect(id).toMatch(/^session_\d+_/);
      expect(service.currentSessionId).toBe(id);
      expect(service.sessions).toHaveLength(1);
      expect(service.sessions[0].title).toBe('My Chat');
      expect(service.sessions[0].model).toBe('gpt-4o');
    });

    it('uses default title and model when not provided', async () => {
      const id = await service.create();
      expect(service.sessions[0].title).toMatch(/^Chat \d+$/);
      expect(service.sessions[0].model).toBe('gpt-4o');
    });

    it('prepends new session to the list', async () => {
      const id1 = await service.create('First');
      const id2 = await service.create('Second');
      expect(service.sessions[0].id).toBe(id2);
      expect(service.sessions[1].id).toBe(id1);
    });

    it('persists session data to storage', async () => {
      const id = await service.create('Persisted', 'gpt-4o');
      const data = await storage.get<any>(`agent:session:${id}`);
      expect(data).toBeDefined();
      expect(data.title).toBe('Persisted');
      expect(data.messages).toEqual([]);
    });

    it('persists session list to storage', async () => {
      await service.create('One');
      await service.create('Two');
      const list = await storage.get<any[]>('agent:session_list');
      expect(list).toHaveLength(2);
      expect(list![0].title).toBe('Two');
    });

    it('handles corrupted sessions array gracefully', async () => {
      (service as any).sessions = null;
      const id = await service.create('Recovery');
      expect(id).toBeDefined();
      expect(service.sessions).toHaveLength(1);
    });

    it('stores projectId when provided', async () => {
      const id = await service.create('With Project', 'gpt-4o', 'proj-1');
      expect(service.sessions[0].projectId).toBe('proj-1');
      const data = await storage.get<any>(`agent:session:${id}`);
      expect(data.projectId).toBe('proj-1');
    });
  });

  // ----------------------------------------------------------
  // 3. loadSession
  // ----------------------------------------------------------
  describe('loadSession', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('returns session data by id', async () => {
      const id = await service.create('Load Test', 'gpt-4o');
      // Manually save some messages
      const data = await storage.get<any>(`agent:session:${id}`);
      data.messages = [{ id: 'm1', role: 'user', content: 'hello' }];
      await storage.set(`agent:session:${id}`, data);

      const loaded = await service.loadSession(id);
      expect(loaded).toBeDefined();
      expect(loaded!.title).toBe('Load Test');
      expect(loaded!.messages).toHaveLength(1);
    });

    it('returns null for non-existent session', async () => {
      const loaded = await service.loadSession('nonexistent');
      expect(loaded).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 4. saveSession
  // ----------------------------------------------------------
  describe('saveSession', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('updates session data and list', async () => {
      const id = await service.create('Before Save');
      const sessionData = {
        id,
        title: 'After Save',
        model: 'gpt-4o',
        messages: [{ id: 'm1', role: 'user', content: 'hello' }],
        createdAt: 1000,
        updatedAt: 1000,
      };
      await service.saveSession(sessionData);

      // Verify storage updated
      const saved = await storage.get<any>(`agent:session:${id}`);
      expect(saved.title).toBe('After Save');
      expect(saved.messages).toHaveLength(1);

      // Verify session list updated
      expect(service.sessions[0].title).toBe('After Save');
      expect(service.sessions[0].messageCount).toBe(1);
    });

    it('updates updatedAt timestamp', async () => {
      const id = await service.create();
      const before = service.sessions[0].updatedAt;
      // Wait a tick to ensure time difference
      await new Promise((r) => setTimeout(r, 1));
      await service.saveSession({
        id,
        title: 'Chat 1',
        model: 'gpt-4o',
        messages: [],
        createdAt: before,
        updatedAt: before,
      });
      expect(service.sessions[0].updatedAt).toBeGreaterThanOrEqual(before);
    });

    it('handles projectId in saveSession', async () => {
      const id = await service.create();
      await service.saveSession({
        id,
        title: 'Chat 1',
        model: 'gpt-4o',
        messages: [],
        createdAt: 1000,
        updatedAt: 1000,
        projectId: 'proj-2',
      });
      expect(service.sessions[0].projectId).toBe('proj-2');
      const saved = await storage.get<any>(`agent:session:${id}`);
      expect(saved.projectId).toBe('proj-2');
    });
  });

  // ----------------------------------------------------------
  // 5. delete
  // ----------------------------------------------------------
  describe('delete', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('removes session from list and storage', async () => {
      const id1 = await service.create('Keep');
      const id2 = await service.create('Delete');
      await service.delete(id2);

      expect(service.sessions).toHaveLength(1);
      expect(service.sessions[0].id).toBe(id1);

      const deleted = await storage.get(`agent:session:${id2}`);
      expect(deleted).toBeNull();
    });

    it('switches currentSessionId if deleting the active session', async () => {
      const id1 = await service.create('First');
      const id2 = await service.create('Second');
      expect(service.currentSessionId).toBe(id2);

      await service.delete(id2);
      expect(service.currentSessionId).toBe(id1);
    });

    it('sets currentSessionId to null if no sessions remain', async () => {
      const id = await service.create();
      await service.delete(id);
      expect(service.currentSessionId).toBeNull();
      expect(service.sessions).toEqual([]);
    });

    it('handles corrupted sessions array gracefully', async () => {
      (service as any).sessions = null;
      const id = await service.create();
      await service.delete(id);
      expect(service.sessions).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // 6. switchTo
  // ----------------------------------------------------------
  describe('switchTo', () => {
    it('changes currentSessionId', async () => {
      await service.init(storage);
      const id1 = await service.create('One');
      const id2 = await service.create('Two');
      service.switchTo(id1);
      expect(service.currentSessionId).toBe(id1);
      service.switchTo(id2);
      expect(service.currentSessionId).toBe(id2);
    });

    it('allows setting to null', () => {
      service.switchTo(null);
      expect(service.currentSessionId).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // 7. updateProjectId
  // ----------------------------------------------------------
  describe('updateProjectId', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('updates projectId in session list and data', async () => {
      const id = await service.create('Test');
      await service.updateProjectId(id, 'proj-new');

      expect(service.sessions[0].projectId).toBe('proj-new');
      const data = await storage.get<any>(`agent:session:${id}`);
      expect(data.projectId).toBe('proj-new');
    });

    it('can clear projectId by passing undefined', async () => {
      const id = await service.create('Test', 'gpt-4o', 'proj-old');
      await service.updateProjectId(id, undefined);
      expect(service.sessions[0].projectId).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 8. updateSessionInfo
  // ----------------------------------------------------------
  describe('updateSessionInfo', () => {
    beforeEach(async () => {
      await service.init(storage);
    });

    it('updates title', async () => {
      const id = await service.create('Old Title');
      await service.updateSessionInfo(id, { title: 'New Title' });
      expect(service.sessions[0].title).toBe('New Title');
      const data = await storage.get<any>(`agent:session:${id}`);
      expect(data.title).toBe('New Title');
    });

    it('updates messageCount', async () => {
      const id = await service.create();
      await service.updateSessionInfo(id, { messageCount: 5 });
      expect(service.sessions[0].messageCount).toBe(5);
    });

    it('updates projectId', async () => {
      const id = await service.create();
      await service.updateSessionInfo(id, { projectId: 'proj-updated' });
      expect(service.sessions[0].projectId).toBe('proj-updated');
    });

    it('updates multiple fields at once', async () => {
      const id = await service.create();
      await service.updateSessionInfo(id, { title: 'Multi', messageCount: 10, projectId: 'p1' });
      const s = service.sessions[0];
      expect(s.title).toBe('Multi');
      expect(s.messageCount).toBe(10);
      expect(s.projectId).toBe('p1');
    });
  });

  // ----------------------------------------------------------
  // 9. Corrupted data handling
  // ----------------------------------------------------------
  describe('corrupted data handling', () => {
    it('clears non-array session list', async () => {
      await storage.set('agent:session_list', 'not an array');
      await service.init(storage);
      expect(service.sessions).toEqual([]);
      // Should delete the invalid entry
      const list = await storage.get('agent:session_list');
      expect(list).toBeNull();
    });

    it('clears sessions with invalid entries', async () => {
      await storage.set('agent:session_list', [
        { id: 'valid', title: 'Good' },
        { id: 123 }, // missing title
      ]);
      await service.init(storage);
      expect(service.sessions).toEqual([]);
    });

    it('clears sessions exceeding 200 limit', async () => {
      const giantList = Array.from({ length: 201 }, (_, i) => ({
        id: `s${i}`,
        title: `Chat ${i}`,
      }));
      await storage.set('agent:session_list', giantList);
      await service.init(storage);
      expect(service.sessions).toEqual([]);
    });
  });
});
