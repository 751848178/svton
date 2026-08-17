import type { SessionRunState } from './chat-run.types';

export const CHAT_RUN_JOURNAL_VERSION = 1 as const;

/** Durable mirror of the run registry; it never accepts independent mutations. */
export interface ChatRunJournalRecord {
  version: typeof CHAT_RUN_JOURNAL_VERSION;
  state: SessionRunState & { sessionId: string };
  updatedAt: number;
}

export interface ChatRunRecovery {
  state: SessionRunState | null;
  recoveredAsInterrupted: boolean;
}

export function toJournalRecord(
  state: SessionRunState,
  updatedAt = Date.now(),
): ChatRunJournalRecord | null {
  if (!state.sessionId) return null;
  return {
    version: CHAT_RUN_JOURNAL_VERSION,
    state: { ...state, sessionId: state.sessionId },
    updatedAt,
  };
}
