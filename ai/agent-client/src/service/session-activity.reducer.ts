import { TERMINAL_RUN_PHASES, type SessionRunState } from './chat-run.types';
import type {
  SessionActivityInput,
  SessionActivityPhase,
  SessionActivityViewModel,
  SessionTerminalIdentity,
  TerminalRunState,
} from './session-activity.types';
import type { SessionActivityMetadata } from './session.types';

const LABELS: Record<SessionActivityPhase, readonly [string, string]> = {
  idle: ['Idle', 'Conversation is idle'],
  inProgress: ['Running', 'Agent is working'],
  waitingOnApproval: ['Needs approval', 'Agent is waiting for tool approval'],
  waitingOnUserInput: ['Needs input', 'Agent is waiting for your input'],
  finalizing: ['Finalizing', 'Agent is finalizing the response'],
  completed: ['Completed', 'Agent completed the run'],
  failed: ['Failed', 'Agent run failed'],
  interrupted: ['Interrupted', 'Agent run was interrupted'],
};

/** Derives row activity from the live run authority and durable terminal/read metadata. */
export function selectSessionActivity({
  session,
  runState,
}: SessionActivityInput): SessionActivityViewModel {
  const durableTerminal = terminalFromMetadata(session);
  const liveTerminal = terminalFromRun(runState);
  const terminal = newerTerminal(durableTerminal, liveTerminal);
  const isUnread = terminal ? !isTerminalRead(session, terminal) : false;
  const livePhase = runState?.phase;
  const phase = livePhase && !TERMINAL_RUN_PHASES.has(livePhase)
    ? livePhase
    : isUnread && terminal
      ? terminal.kind
      : 'idle';
  const [statusLabel, statusDescription] = LABELS[phase];
  return {
    sessionId: session.id,
    phase,
    isUnread,
    statusLabel,
    statusDescription,
    terminal,
    ...(phase === 'failed' && runState?.error?.message
      ? { errorMessage: runState.error.message }
      : {}),
  };
}

export function applyTerminalMetadata<T extends SessionActivityMetadata>(
  current: T,
  terminal: TerminalRunState,
): T {
  const candidate = terminalFromRun(terminal);
  const existing = terminalFromMetadata(current);
  if (!candidate || newerTerminal(existing, candidate) === existing) return current;
  return {
    ...current,
    lastTerminalAt: candidate.at,
    lastTerminalKind: candidate.kind,
    lastTerminalRunId: candidate.runId,
    lastTerminalRevision: candidate.turnRevision,
  };
}

export function applyReadMetadata<T extends SessionActivityMetadata>(
  current: T,
  terminal: SessionTerminalIdentity,
  at: number,
): T {
  const durable = terminalFromMetadata(current);
  if (!durable || !sameTerminal(durable, terminal) || isTerminalRead(current, terminal)) return current;
  return {
    ...current,
    lastReadAt: Math.max(at, terminal.at),
    lastReadRunId: terminal.runId,
    lastReadRevision: terminal.turnRevision,
  };
}

export function isTerminalRead(
  metadata: SessionActivityMetadata,
  terminal: SessionTerminalIdentity,
): boolean {
  const readRevision = metadata.lastReadRevision ?? -1;
  if (readRevision > terminal.turnRevision) return true;
  return readRevision === terminal.turnRevision
    && metadata.lastReadRunId === terminal.runId
    && (metadata.lastReadAt ?? -1) >= terminal.at;
}

export function isTerminalRunState(state: SessionRunState | null): state is TerminalRunState {
  return !!state?.sessionId
    && TERMINAL_RUN_PHASES.has(state.phase)
    && typeof state.completedAt === 'number';
}

function terminalFromRun(state: SessionRunState | null): SessionTerminalIdentity | null {
  return isTerminalRunState(state) ? {
    runId: state.runId,
    turnRevision: state.turnRevision,
    kind: state.phase,
    at: state.completedAt,
  } : null;
}

function terminalFromMetadata(metadata: SessionActivityMetadata): SessionTerminalIdentity | null {
  return metadata.lastTerminalRunId
    && metadata.lastTerminalKind
    && metadata.lastTerminalRevision !== undefined
    && metadata.lastTerminalAt !== undefined
    ? {
        runId: metadata.lastTerminalRunId,
        turnRevision: metadata.lastTerminalRevision,
        kind: metadata.lastTerminalKind,
        at: metadata.lastTerminalAt,
      }
    : null;
}

function newerTerminal(
  current: SessionTerminalIdentity | null,
  candidate: SessionTerminalIdentity | null,
): SessionTerminalIdentity | null {
  if (!current) return candidate;
  if (!candidate) return current;
  if (candidate.turnRevision !== current.turnRevision) {
    return candidate.turnRevision > current.turnRevision ? candidate : current;
  }
  if (candidate.runId === current.runId) return current;
  return candidate.at > current.at ? candidate : current;
}

function sameTerminal(a: SessionTerminalIdentity, b: SessionTerminalIdentity): boolean {
  return a.runId === b.runId && a.turnRevision === b.turnRevision && a.at === b.at;
}
