import { describe, expect, it } from 'vitest';
import {
  applyReadMetadata,
  applyTerminalMetadata,
  selectSessionActivity,
} from '../src/service/session-activity.reducer';
import { migrateSessionData, migrateSessionInfo } from '../src/service/session-metadata-migration';
import type { SessionTerminalIdentity, TerminalRunState } from '../src/service/session-activity.types';
import type { SessionData, SessionInfo } from '../src/service/session.types';

describe('session activity projection', () => {
  it.each([
    'inProgress',
    'waitingOnApproval',
    'waitingOnUserInput',
    'finalizing',
    'completed',
    'failed',
    'interrupted',
  ] as const)('projects the authoritative %s run phase', (phase) => {
    const activity = selectSessionActivity({
      session: info(),
      runState: run(phase),
    });
    expect(activity.phase).toBe(phase);
  });

  it('keeps a background terminal unread until its exact terminal is read', () => {
    const terminal = run('completed');
    const withTerminal = applyTerminalMetadata(info(), terminal);
    const unread = selectSessionActivity({ session: withTerminal, runState: null });
    expect(unread).toMatchObject({ phase: 'completed', isUnread: true });
    const read = applyReadMetadata(withTerminal, unread.terminal!, 30);
    expect(selectSessionActivity({ session: read, runState: null })).toMatchObject({
      phase: 'idle', isUnread: false, terminal: unread.terminal,
    });
  });

  it('does not let duplicate or stale terminals re-mark a read session unread', () => {
    const completed = run('completed');
    const first = applyTerminalMetadata(info(), completed);
    const terminal = selectSessionActivity({ session: first, runState: null }).terminal!;
    const read = applyReadMetadata(first, terminal, 30);
    const duplicate = applyTerminalMetadata(read, { ...completed, completedAt: 99 });
    const stale = applyTerminalMetadata(duplicate, {
      ...run('failed'), runId: 'stale', turnRevision: 0, completedAt: 100,
    });
    expect(duplicate).toBe(read);
    expect(stale).toBe(read);
    expect(selectSessionActivity({ session: stale, runState: null })).toMatchObject({
      phase: 'idle', isUnread: false,
    });
  });

  it('marks a newer failed or interrupted revision unread monotonically', () => {
    const old = applyTerminalMetadata(info(), run('completed'));
    const oldIdentity = selectSessionActivity({ session: old, runState: null }).terminal!;
    const read = applyReadMetadata(old, oldIdentity, 30);
    const failed = applyTerminalMetadata(read, {
      ...run('failed'), runId: 'run-2', turnRevision: 2, completedAt: 40,
    });
    expect(selectSessionActivity({ session: failed, runState: null })).toMatchObject({
      phase: 'failed', isUnread: true,
    });
    const interrupted = applyTerminalMetadata(failed, {
      ...run('interrupted'), runId: 'run-3', turnRevision: 3, completedAt: 50,
    });
    expect(selectSessionActivity({ session: interrupted, runState: null }).phase)
      .toBe('interrupted');
  });
});

describe('session activity metadata migration', () => {
  it('migrates old info/data with safe idle defaults and reconstructs terminal state', () => {
    const oldInfo = info();
    const oldData: SessionData = { ...oldInfo, messages: [] };
    expect(migrateSessionInfo(oldInfo)).toMatchObject({ schemaVersion: 3 });
    expect(migrateSessionData(oldData)).toMatchObject({ schemaVersion: 3 });
    expect(selectSessionActivity({ session: migrateSessionInfo(oldInfo), runState: null }))
      .toMatchObject({ phase: 'idle', isUnread: false });

    const stored = applyTerminalMetadata(migrateSessionInfo(oldInfo), run('interrupted'));
    expect(selectSessionActivity({ session: migrateSessionInfo(stored), runState: null }))
      .toMatchObject({ phase: 'interrupted', isUnread: true });
  });

  it('drops partial or malformed terminal/read tuples', () => {
    const migrated = migrateSessionInfo({
      ...info(),
      lastTerminalAt: 20,
      lastTerminalKind: 'completed',
      lastReadAt: 30,
    });
    expect(migrated.lastTerminalAt).toBeUndefined();
    expect(migrated.lastReadAt).toBeUndefined();
  });
});

function info(): SessionInfo {
  return {
    id: 'session-a', title: 'A', model: 'test', messageCount: 0,
    createdAt: 1, updatedAt: 1, schemaVersion: 3,
    titleSource: 'auto', isPinned: false, recencyAt: 1,
  };
}

function run(phase: TerminalRunState['phase'] | 'inProgress' | 'waitingOnApproval' | 'waitingOnUserInput' | 'finalizing') {
  return {
    sessionId: 'session-a', runId: 'run-1', turnRevision: 1, phase,
    startedAt: 10, completedAt: ['completed', 'failed', 'interrupted'].includes(phase) ? 20 : undefined,
    pendingApprovalIds: phase === 'waitingOnApproval' ? ['approval'] : [],
    pendingUserInputIds: phase === 'waitingOnUserInput' ? ['input'] : [],
    revision: 1,
  } as TerminalRunState;
}

void ({} as SessionTerminalIdentity);
