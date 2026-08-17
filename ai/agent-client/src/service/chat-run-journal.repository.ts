import type { IStorage } from '@svton/agent-platform';
import { CHAT_RUN_JOURNAL_VERSION, type ChatRunJournalRecord } from './chat-run-journal.types';
import { TERMINAL_RUN_PHASES, type ChatRunPhase, type SessionRunState } from './chat-run.types';

export const CHAT_RUN_JOURNAL_PREFIX = 'agent:run-journal:';

/** Owns durable run-journal keys, validation, latest-write policy, and deletion. */
export class ChatRunJournalRepository {
  constructor(private readonly storage: IStorage) {}

  async load(sessionId: string): Promise<ChatRunJournalRecord | null> {
    return parseJournal(await this.storage.get<unknown>(CHAT_RUN_JOURNAL_PREFIX + sessionId), sessionId);
  }

  async saveLatest(record: ChatRunJournalRecord): Promise<boolean> {
    const current = await this.load(record.state.sessionId);
    if (current && !isAtLeastAsNew(record.state, current.state)) return false;
    await this.storage.set(CHAT_RUN_JOURNAL_PREFIX + record.state.sessionId, record);
    return true;
  }

  delete(sessionId: string): Promise<void> {
    return this.storage.delete(CHAT_RUN_JOURNAL_PREFIX + sessionId);
  }
}

function parseJournal(value: unknown, sessionId: string): ChatRunJournalRecord | null {
  if (!isRecord(value) || value.version !== CHAT_RUN_JOURNAL_VERSION) return null;
  if (!isRunState(value.state, sessionId)) return null;
  if (!Number.isFinite(value.updatedAt) || (value.updatedAt as number) < 0) return null;
  return value as unknown as ChatRunJournalRecord;
}

function isRunState(value: unknown, sessionId: string): value is SessionRunState {
  if (!isRecord(value) || value.sessionId !== sessionId) return false;
  if (!isId(value.runId) || !isPhase(value.phase)) return false;
  if (!positiveInteger(value.turnRevision) || !positiveInteger(value.revision)) return false;
  if (!finiteTime(value.startedAt) || !optionalTime(value.completedAt)) return false;
  if (!optionalError(value.error)) return false;
  if (value.phase === 'failed' && !isRecord(value.error)) return false;
  if (value.phase !== 'failed' && value.error !== undefined) return false;
  return stringList(value.pendingApprovalIds) && stringList(value.pendingUserInputIds)
    && (!TERMINAL_RUN_PHASES.has(value.phase as ChatRunPhase) || finiteTime(value.completedAt));
}

function isAtLeastAsNew(next: SessionRunState, current: SessionRunState): boolean {
  if (next.turnRevision !== current.turnRevision) return next.turnRevision > current.turnRevision;
  if (next.runId !== current.runId) return false;
  return next.revision >= current.revision;
}

function isPhase(value: unknown): value is ChatRunPhase {
  return typeof value === 'string' && [
    'inProgress', 'waitingOnApproval', 'waitingOnUserInput', 'finalizing',
    'completed', 'failed', 'interrupted',
  ].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function finiteTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function optionalTime(value: unknown): boolean {
  return value === undefined || finiteTime(value);
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 128 && value.every(isId);
}

function optionalError(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || typeof value.message !== 'string') return false;
  if (value.message.length === 0 || value.message.length > 2_000) return false;
  if (value.code !== undefined
    && (typeof value.code !== 'string' || value.code.length > 128)) return false;
  return value.retryable === undefined || typeof value.retryable === 'boolean';
}
