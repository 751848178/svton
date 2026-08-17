import {
  TERMINAL_RUN_PHASES,
  type ChatRunPhase,
  type ChatRunTransition,
  type SessionRunState,
} from './chat-run.types';

const ID_LIMIT = 512;
const PENDING_LIMIT = 128;

/** Pure, validated and idempotent reducer for one session-owned run. */
export function reduceSessionRunState(
  current: SessionRunState | null,
  transition: ChatRunTransition,
): SessionRunState | null {
  if (!isValidTransition(transition)) return current;
  if (transition.type === 'start') return startRun(current, transition);
  if (!ownsTransition(current, transition)) return current;
  if (TERMINAL_RUN_PHASES.has(current.phase)) return current;

  switch (transition.type) {
    case 'approvalRequested':
      return requestDecision(current, 'approval', transition.requestId);
    case 'approvalSettled':
      return settleDecision(current, 'approval', transition.requestId);
    case 'userInputRequested':
      return requestDecision(current, 'userInput', transition.requestId);
    case 'userInputSettled':
      return settleDecision(current, 'userInput', transition.requestId);
    case 'finalizing':
      return current.phase === 'finalizing'
        ? current
        : revise(current, { phase: 'finalizing' });
    case 'completed':
      return terminal(current, 'completed', transition.at);
    case 'failed':
      return terminal(current, 'failed', transition.at, normalizeError(transition.error));
    case 'interrupted':
      return terminal(current, 'interrupted', transition.at);
  }
}

function startRun(
  current: SessionRunState | null,
  transition: Extract<ChatRunTransition, { type: 'start' }>,
): SessionRunState {
  if (current?.runId === transition.runId && current.sessionId === transition.sessionId) {
    return current;
  }
  return {
    sessionId: transition.sessionId,
    runId: transition.runId,
    turnRevision: (current?.turnRevision ?? 0) + 1,
    phase: 'inProgress',
    startedAt: transition.at,
    pendingApprovalIds: [],
    pendingUserInputIds: [],
    revision: (current?.revision ?? 0) + 1,
  };
}

function requestDecision(
  state: SessionRunState,
  kind: 'approval' | 'userInput',
  requestId: string,
): SessionRunState {
  const field = kind === 'approval' ? 'pendingApprovalIds' : 'pendingUserInputIds';
  if (state.phase === 'finalizing' || state[field].includes(requestId)) return state;
  if (state[field].length >= PENDING_LIMIT) return state;
  const next = { ...state, [field]: [...state[field], requestId] };
  return revise(next, { phase: deriveActivePhase(next) });
}

function settleDecision(
  state: SessionRunState,
  kind: 'approval' | 'userInput',
  requestId: string,
): SessionRunState {
  if (state.phase === 'finalizing') return state;
  const field = kind === 'approval' ? 'pendingApprovalIds' : 'pendingUserInputIds';
  if (!state[field].includes(requestId)) return state;
  const next = { ...state, [field]: state[field].filter((id) => id !== requestId) };
  return revise(next, { phase: deriveActivePhase(next) });
}

function deriveActivePhase(state: SessionRunState): ChatRunPhase {
  if (state.pendingApprovalIds.length > 0) return 'waitingOnApproval';
  if (state.pendingUserInputIds.length > 0) return 'waitingOnUserInput';
  return 'inProgress';
}

function terminal(
  state: SessionRunState,
  phase: 'completed' | 'failed' | 'interrupted',
  at: number,
  error?: SessionRunState['error'],
): SessionRunState {
  return revise(state, {
    phase,
    completedAt: Math.max(state.startedAt, at),
    pendingApprovalIds: [],
    pendingUserInputIds: [],
    ...(error ? { error } : { error: undefined }),
  });
}

function revise(state: SessionRunState, patch: Partial<SessionRunState>): SessionRunState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function ownsTransition(
  state: SessionRunState | null,
  transition: ChatRunTransition,
): state is SessionRunState {
  return state !== null
    && state.sessionId === transition.sessionId
    && state.runId === transition.runId;
}

function isValidTransition(transition: ChatRunTransition): boolean {
  if (!isBoundedId(transition.runId)) return false;
  if (transition.sessionId !== null && !isBoundedId(transition.sessionId)) return false;
  if ('requestId' in transition && !isBoundedId(transition.requestId)) return false;
  if ('at' in transition && (!Number.isFinite(transition.at) || transition.at < 0)) return false;
  return true;
}

function isBoundedId(value: string): boolean {
  return value.length > 0 && value.length <= ID_LIMIT;
}

function normalizeError(error: SessionRunState['error']): SessionRunState['error'] {
  const message = error?.message.trim().slice(0, 2_000) || 'Agent run failed';
  const code = error?.code?.trim().slice(0, 128);
  return { message, ...(code ? { code } : {}), ...(error?.retryable !== undefined ? { retryable: error.retryable } : {}) };
}
