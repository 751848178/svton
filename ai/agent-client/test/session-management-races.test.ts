import { describe, expect, it } from 'vitest';
import type { IStorage } from '@svton/agent-platform';
import { ChatService } from '../src/service/chat.service';
import { SessionService } from '../src/service/session.service';
import type { SessionData } from '../src/service/session.types';
import type { TerminalRunState } from '../src/service/session-activity.types';
import {
  buildPiAgentConfig,
  makeBrowserPlatform,
  MemoryStorage,
} from './helpers/pi-test-utils';

describe('session management serialization', () => {
  it('preserves terminal, manual title, and archive policy across interleaved writes', async () => {
    const storage = new MemoryStorage();
    const service = new SessionService();
    await service.init(storage, {
      clock: { now: () => 20 }, idGen: { nextId: () => 'session-a' },
    });
    const id = await service.create();
    const stale = (await service.loadSession(id))!;
    await Promise.all([
      service.saveSession(withMessage(stale, 'completed evidence'), terminal(id)),
      service.rename(id, 'Manual title'),
      service.setPinned(id, true),
      service.archive(id),
    ]);
    const fresh = new SessionService();
    await fresh.init(storage);
    expect(fresh.sessions[0]).toMatchObject({
      title: 'Manual title', titleSource: 'manual', isPinned: false,
      archivedAt: 20, lastTerminalRunId: 'run-1', messageCount: 1,
    });
    expect((await fresh.loadSession(id))?.title).toBe('Manual title');
  });

  it('does not resurrect completion or search state when permanent deletion wins', async () => {
    const storage = new BlockingStorage();
    const service = new SessionService();
    await service.init(storage, { idGen: { nextId: () => 'session-a' } });
    const id = await service.create('A');
    const data = (await service.loadSession(id))!;
    storage.blockNextSessionWrite(id);
    const completion = service.saveSession(
      withMessage(data, 'late completion marker'), terminal(id),
    );
    await storage.started;
    const deletion = service.delete(id);
    const search = service.search('late completion marker', { includeContent: true });
    storage.release();
    await expect(search).resolves.toEqual([]);
    await Promise.all([completion, deletion]);
    expect(await storage.get(`agent:session:${id}`)).toBeNull();
    expect(await storage.get(`agent:session_search:${id}`)).toBeNull();
    expect(await storage.get('agent:session_list')).toEqual([]);
    expect(await storage.get('agent:session_current')).toBeNull();
    const fresh = new SessionService();
    await fresh.init(storage);
    expect(fresh.sessions).toEqual([]);
  });

  it('removes checkpoint and journal durable state through ChatService deletion', async () => {
    const storage = new MemoryStorage();
    const chat = new ChatService();
    await chat.init(makeBrowserPlatform(storage), buildPiAgentConfig().config, 'session-a');
    await storage.set('agent:checkpoint:session-a', 'checkpoint');
    await storage.set('agent:run-journal:session-a', { stale: true });
    await chat.deleteSessionState('session-a');
    expect(await storage.get('agent:checkpoint:session-a')).toBeNull();
    expect(await storage.get('agent:run-journal:session-a')).toBeNull();
  });

  it('deletes a corrupt same-id data record when loading it', async () => {
    const storage = new MemoryStorage();
    await storage.set('agent:session:session-a', {
      id: 'session-a', title: 'broken without base fields', messages: [],
    });
    const service = new SessionService();
    await service.init(storage);
    await expect(service.loadSession('session-a')).resolves.toBeNull();
    expect(await storage.get('agent:session:session-a')).toBeNull();
  });
});

function withMessage(data: SessionData, content: string): SessionData {
  return { ...data, messages: [{ role: 'user', content }] };
}

function terminal(sessionId: string): TerminalRunState {
  return {
    sessionId, runId: 'run-1', turnRevision: 1, phase: 'completed',
    startedAt: 1, completedAt: 2, pendingApprovalIds: [],
    pendingUserInputIds: [], revision: 1,
  };
}

class BlockingStorage implements IStorage {
  private readonly base = new MemoryStorage();
  private blockedKey: string | null = null;
  private unblock: () => void = () => {};
  private markStarted: () => void = () => {};
  readonly started = new Promise<void>((resolve) => { this.markStarted = resolve; });

  blockNextSessionWrite(id: string) { this.blockedKey = `agent:session:${id}`; }
  release() { this.unblock(); }
  get<T>(key: string) { return this.base.get<T>(key); }
  delete(key: string) { return this.base.delete(key); }
  list(prefix?: string) { return this.base.list(prefix); }
  clear() { return this.base.clear(); }
  async set<T>(key: string, value: T) {
    if (key === this.blockedKey) {
      this.blockedKey = null;
      this.markStarted();
      await new Promise<void>((resolve) => { this.unblock = resolve; });
    }
    await this.base.set(key, value);
  }
}
