import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSessionManagement } from '../src/hooks/use-session-management.hooks';
import { useSessionSearch } from '../src/hooks/use-session-search.hooks';
import { useSessionCreateSwitch } from '../src/hooks/use-session-create-switch.hooks';
import { SessionTransitionQueue } from '../src/service/session-transition-queue.service';

describe('session management controller', () => {
  it('rejects active archive and stop-and-archive addresses only the requested session', async () => {
    const order: string[] = [];
    const chat = {
      activeSessionId: 'session-b',
      isSessionStreaming: vi.fn((id) => id === 'session-a'),
      abortSession: vi.fn((id) => { order.push(`abort:${id}`); return true; }),
      flushRunJournal: vi.fn(async (id) => { order.push(`journal:${id}`); }),
    };
    const session = {
      archive: vi.fn(async (id) => { order.push(`archive:${id}`); return true; }),
      rename: vi.fn(), setPinned: vi.fn(), unarchive: vi.fn(),
    };
    const { result } = renderHook(() => useSessionManagement({
      chatService: chat as any,
      sessionService: session as any,
      transitionQueue: new SessionTransitionQueue(),
      isSwitching: { current: false },
      flushSessionWrites: async () => { order.push('flush'); },
      runSessionMutation: (mutation) => mutation(),
      deleteSession: vi.fn(),
    }));
    await act(async () => {
      expect(await result.current.archive('session-a')).toEqual({ ok: false, reason: 'active' });
    });
    expect(order).toEqual([]);
    await act(async () => {
      expect(await result.current.stopAndArchive('session-a')).toEqual({ ok: true });
    });
    expect(order).toEqual([
      'abort:session-a', 'flush', 'journal:session-a', 'archive:session-a',
    ]);
  });

  it('does not bind or load an invalid switch target', async () => {
    const chat = {
      activeSessionId: null, messages: [], status: 'idle',
      hasPendingApprovalsForSession: () => false,
      bindSession: vi.fn(), loadMessages: vi.fn(), cacheSessionMessages: vi.fn(),
    };
    const session = { switchTo: vi.fn().mockResolvedValue(false), loadSession: vi.fn() };
    const { result } = renderHook(() => useSessionCreateSwitch({
      chatService: chat as any,
      sessionService: session as any,
      transitionQueue: new SessionTransitionQueue(),
      isSwitching: { current: false },
      saveSessionMessages: vi.fn(),
    }));
    await act(async () => { await result.current.switchTo('missing'); });
    expect(session.switchTo).toHaveBeenCalledWith('missing');
    expect(chat.bindSession).not.toHaveBeenCalled();
    expect(session.loadSession).not.toHaveBeenCalled();
  });
});

describe('session search controller', () => {
  it('keeps content opt-in and exposes a retryable semantic error', async () => {
    let failing = true;
    const service = { search: vi.fn(() => failing
      ? Promise.reject(new Error('storage secret'))
      : Promise.resolve([])) };
    const emptySessions: never[] = [];
    const { result } = renderHook(() => useSessionSearch(service as any, emptySessions));
    await waitFor(() => expect(result.current.error).toBe('unavailable'));
    expect(service.search).toHaveBeenCalledWith('', {
      scope: 'active', includeContent: false,
    });
    failing = false;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(service.search.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores a stale search failure after a newer generation succeeds', async () => {
    let rejectOld!: (error: Error) => void;
    const old = new Promise<never>((_resolve, reject) => { rejectOld = reject; });
    const service = { search: vi.fn((query: string) => query ? Promise.resolve([]) : old) };
    const emptySessions: never[] = [];
    const { result } = renderHook(() => useSessionSearch(service as any, emptySessions));
    act(() => result.current.setQuery('new'));
    await waitFor(() => expect(service.search.mock.calls.some(([query]) => query === 'new')).toBe(true));
    await waitFor(() => expect(result.current.searching).toBe(false));
    rejectOld(new Error('stale'));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.error).toBeNull();
  });
});
