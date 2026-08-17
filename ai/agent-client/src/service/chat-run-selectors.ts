import type { ChatStatus } from '../types';
import { TERMINAL_RUN_PHASES, type SessionRunState } from './chat-run.types';

export type ChatComposerMode = 'send' | 'stop' | 'approval' | 'userInput' | 'error';

export interface ChatComposerState {
  mode: ChatComposerMode;
  isStreaming: boolean;
}

export interface PendingDecisionSummary {
  kind: 'approval' | 'userInput';
  requestId: string;
  count: number;
}

export function selectCompatibilityStatus(state: SessionRunState | null): ChatStatus {
  if (!state || state.phase === 'completed' || state.phase === 'interrupted') return 'idle';
  if (state.phase === 'failed') return 'error';
  if (state.phase === 'waitingOnApproval') return 'waiting_approval';
  return 'running';
}

export function selectComposerState(state: SessionRunState | null): ChatComposerState {
  if (!state || TERMINAL_RUN_PHASES.has(state.phase)) {
    return { mode: state?.phase === 'failed' ? 'error' : 'send', isStreaming: false };
  }
  if (state.phase === 'waitingOnApproval') return { mode: 'approval', isStreaming: true };
  if (state.phase === 'waitingOnUserInput') return { mode: 'userInput', isStreaming: true };
  return { mode: 'stop', isStreaming: true };
}

export function selectPendingDecision(
  state: SessionRunState | null,
): PendingDecisionSummary | null {
  if (!state || TERMINAL_RUN_PHASES.has(state.phase)) return null;
  if (state.pendingApprovalIds.length > 0) {
    return {
      kind: 'approval',
      requestId: state.pendingApprovalIds[0],
      count: state.pendingApprovalIds.length,
    };
  }
  if (state.pendingUserInputIds.length > 0) {
    return {
      kind: 'userInput',
      requestId: state.pendingUserInputIds[0],
      count: state.pendingUserInputIds.length,
    };
  }
  return null;
}
