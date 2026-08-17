import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/pi-test-utils';
import { ChatRunCoordinatorService } from '../src/service/chat-run-coordinator.service';
import { ChatRunJournalService } from '../src/service/chat-run-journal.service';
import { CHAT_RUN_JOURNAL_PREFIX } from '../src/service/chat-run-journal.repository';
import type { SessionRunState } from '../src/service/chat-run.types';

const ADDRESS = { sessionId: 'session-a', runId: 'run-a' } as const;

describe('durable run journal', () => {
  it('persists in-progress before work and terminalizes idempotently', async () => {
    const storage = new MemoryStorage();
    const coordinator = new ChatRunCoordinatorService(() => {}, () => 'run-a');
    coordinator.attachStorage(storage);
    coordinator.start(ADDRESS, 10);
    await coordinator.flush('session-a');
    expect(await readState(storage)).toMatchObject({
      phase: 'inProgress', turnRevision: 1, revision: 1,
    });
    coordinator.finalizing(ADDRESS);
    const publish = vi.fn();
    coordinator.settle({ type: 'completed', ...ADDRESS, at: 20 }, publish);
    coordinator.settle({ type: 'failed', ...ADDRESS, at: 30, error: { message: 'late' } }, publish);
    await coordinator.flush('session-a');
    expect(await readState(storage)).toMatchObject({
      phase: 'completed', completedAt: 20, revision: 3,
    });
    expect(publish).toHaveBeenCalledOnce();
  });

  it.each(['inProgress', 'finalizing'] as const)(
    'recovers stale %s as interrupted and never active',
    async (phase) => {
      const storage = new MemoryStorage();
      await storage.set(CHAT_RUN_JOURNAL_PREFIX + 'session-a', record(state(phase)));
      const coordinator = new ChatRunCoordinatorService();
      coordinator.attachStorage(storage);
      const recovery = await coordinator.recover('session-a', 50);
      expect(recovery.recoveredAsInterrupted).toBe(true);
      expect(recovery.state).toMatchObject({
        runId: 'run-a', phase: 'interrupted', completedAt: 50,
      });
      expect(coordinator.isStreaming('session-a')).toBe(false);
      expect((await readState(storage))?.phase).toBe('interrupted');
    },
  );

  it('restores a completed record without inventing a new transition', async () => {
    const storage = new MemoryStorage();
    await storage.set(CHAT_RUN_JOURNAL_PREFIX + 'session-a', record({
      ...state('completed'), completedAt: 20,
    }));
    const coordinator = new ChatRunCoordinatorService();
    coordinator.attachStorage(storage);
    const recovery = await coordinator.recover('session-a');
    expect(recovery.recoveredAsInterrupted).toBe(false);
    expect(recovery.state?.phase).toBe('completed');
  });

  it('serializes A/B independently and prevents late writes after delete', async () => {
    const storage = new BlockingStorage();
    const journal = new ChatRunJournalService();
    journal.configure(storage);
    const a = journal.persist(state('inProgress'));
    const b = journal.persist({
      ...state('inProgress'), sessionId: 'session-b', runId: 'run-b',
    });
    await storage.started;
    const deletion = journal.delete('session-a');
    await journal.persist({ ...state('completed'), completedAt: 30, revision: 2 });
    storage.release();
    await Promise.all([a, b, deletion]);
    expect(await storage.get(CHAT_RUN_JOURNAL_PREFIX + 'session-a')).toBeNull();
    expect(await storage.get(CHAT_RUN_JOURNAL_PREFIX + 'session-b')).not.toBeNull();
  });

  it('rejects malformed persisted error state instead of hydrating it', async () => {
    const storage = new MemoryStorage();
    await storage.set(CHAT_RUN_JOURNAL_PREFIX + 'session-a', {
      ...record(state('failed')),
      state: { ...state('failed'), completedAt: 20, error: { message: 42 } },
    });
    const coordinator = new ChatRunCoordinatorService();
    coordinator.attachStorage(storage);
    await expect(coordinator.recover('session-a')).resolves.toEqual({
      state: null, recoveredAsInterrupted: false,
    });
  });
});

function state(phase: SessionRunState['phase']): SessionRunState {
  return {
    ...ADDRESS,
    turnRevision: 1,
    phase,
    startedAt: 10,
    pendingApprovalIds: [],
    pendingUserInputIds: [],
    revision: phase === 'inProgress' ? 1 : 2,
  };
}

function record(value: SessionRunState) {
  return { version: 1, state: value, updatedAt: 20 };
}

async function readState(storage: MemoryStorage): Promise<SessionRunState | undefined> {
  const value = await storage.get<{ state: SessionRunState }>(
    CHAT_RUN_JOURNAL_PREFIX + 'session-a',
  );
  return value?.state;
}

class BlockingStorage extends MemoryStorage {
  private unblock: () => void = () => {};
  private markStarted: () => void = () => {};
  readonly started = new Promise<void>((resolve) => { this.markStarted = resolve; });

  override async set<T>(key: string, value: T): Promise<void> {
    if (key === CHAT_RUN_JOURNAL_PREFIX + 'session-a') {
      this.markStarted();
      await new Promise<void>((resolve) => { this.unblock = resolve; });
    }
    await super.set(key, value);
  }

  release(): void {
    this.unblock();
  }
}
