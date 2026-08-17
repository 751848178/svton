import type { ChatRunPhase, SessionRunState } from './chat-run.types';
import type { SessionInfo, SessionTerminalKind } from './session.types';

export type SessionActivityPhase = 'idle' | ChatRunPhase;

export interface SessionTerminalIdentity {
  runId: string;
  turnRevision: number;
  kind: SessionTerminalKind;
  at: number;
}

export interface SessionActivityViewModel {
  sessionId: string;
  phase: SessionActivityPhase;
  isUnread: boolean;
  statusLabel: string;
  statusDescription: string;
  terminal: SessionTerminalIdentity | null;
  errorMessage?: string;
}

export type TerminalRunState = SessionRunState & {
  sessionId: string;
  phase: SessionTerminalKind;
  completedAt: number;
};

export interface SessionActivityInput {
  session: SessionInfo;
  runState: SessionRunState | null;
}
