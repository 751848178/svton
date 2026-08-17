import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IStorage } from '@svton/agent-platform';
import { useSessionActivity } from '../src/hooks/use-session-activity.hooks';
import { selectSessionActivity } from '../src/service/session-activity.reducer';
import { SessionService } from '../src/service/session.service';
import type { SessionInfo } from '../src/service/session.types';
import type { TerminalRunState } from '../src/service/session-activity.types';

describe('durable session activity integration', () => {
  it('commits terminal and exact read identity to list/data and reconstructs it', async () => {
    const storage = memoryStorage();
    const service = new SessionService();
    await service.init(storage);
    const id = await service.create('A', 'test');
    const data = await service.loadSession(id);
    await service.saveSession(data!, terminal(id));

    const list = await storage.get<SessionInfo[]>('agent:session_list');
    const stored = await storage.get<SessionInfo>(`agent:session:${id}`);
    expect(list?.[0]).toMatchObject({
      lastTerminalRunId: 'run-1', lastTerminalRevision: 1, lastTerminalKind: 'completed',
    });
    expect(stored).toMatchObject({ lastTerminalRunId: 'run-1' });

    const reconstructed = new SessionService();
    await reconstructed.init(storage);
    const activity = selectSessionActivity({ session: reconstructed.sessions[0], runState: null });
    expect(activity.isUnread).toBe(true);
    await reconstructed.markRead(id, activity.terminal!, 30);

    const again = new SessionService();
    await again.init(storage);
    expect(selectSessionActivity({ session: again.sessions[0], runState: null }).isUnread)
      .toBe(false);
  });

  it('does not resurrect terminal/read writes that finish after deletion begins', async () => {
    const storage = new BlockingStorage();
    const service = new SessionService();
    await service.init(storage);
    const id = await service.create('A', 'test');
    const data = await service.loadSession(id);
    storage.blockNextSessionWrite(id);
    const save = service.saveSession(data!, terminal(id));
    await storage.started;
    service.beginDelete(id);
    const deletion = service.delete(id);
    storage.release();
    await Promise.all([save, deletion]);
    expect(await storage.get(`agent:session:${id}`)).toBeNull();
    expect(await storage.get('agent:session_list')).toEqual([]);
    expect(service.sessions).toEqual([]);
  });
});

describe('selected-visible read clearing', () => {
  it('keeps hidden/background unread and rechecks selection before a queued commit', async () => {
    let visibility: DocumentVisibilityState = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => visibility,
    });
    const session = terminalInfo();
    let shouldCommit: (() => boolean) | undefined;
    const markRead = vi.fn(async (_id, _terminal, predicate: () => boolean) => {
      shouldCommit = predicate;
      return false;
    });
    const chatService = { runStateVersion: 0, getSessionRunState: () => null } as any;
    const chatInternal = { subscribe: () => () => {}, getState: () => 0 } as any;
    const { rerender } = renderHook(
      ({ currentSessionId, ready }) => useSessionActivity({
        sessions: [session], currentSessionId, ready,
        chatService, chatInternal, markRead,
      }),
      { initialProps: { currentSessionId: 'session-a' as string | null, ready: true } },
    );
    expect(markRead).not.toHaveBeenCalled();

    visibility = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(markRead).toHaveBeenCalledOnce());
    rerender({ currentSessionId: 'session-b', ready: true });
    expect(shouldCommit?.()).toBe(false);

    markRead.mockClear();
    rerender({ currentSessionId: 'session-a', ready: false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(markRead).not.toHaveBeenCalled();
  });
});

function terminal(sessionId: string): TerminalRunState {
  return {
    sessionId, runId: 'run-1', turnRevision: 1, phase: 'completed',
    startedAt: 10, completedAt: 20, pendingApprovalIds: [],
    pendingUserInputIds: [], revision: 2,
  };
}

function terminalInfo(): SessionInfo {
  return {
    id: 'session-a', title: 'A', model: 'test', messageCount: 1,
    createdAt: 1, updatedAt: 20, schemaVersion: 3,
    titleSource: 'auto', isPinned: false, recencyAt: 20,
    lastTerminalAt: 20, lastTerminalKind: 'completed',
    lastTerminalRunId: 'run-1', lastTerminalRevision: 1,
  };
}

function memoryStorage(): IStorage {
  const values = new Map<string, unknown>();
  return {
    get: async <T,>(key: string) => (values.get(key) ?? null) as T | null,
    set: async (key, value) => { values.set(key, value); },
    delete: async (key) => { values.delete(key); },
    list: async (prefix = '') => [...values.keys()].filter((key) => key.startsWith(prefix)),
    clear: async () => { values.clear(); },
  };
}

class BlockingStorage implements IStorage {
  private readonly base = memoryStorage();
  private blockedKey: string | null = null;
  private unblock: () => void = () => {};
  private markStarted: () => void = () => {};
  started = new Promise<void>((resolve) => { this.markStarted = resolve; });

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

void React;
