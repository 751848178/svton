export type ChatRunPhase =
  | 'inProgress'
  | 'waitingOnApproval'
  | 'waitingOnUserInput'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'interrupted';

export interface ChatRunAddress {
  /** Null is the non-colliding key for a run started before a session is bound. */
  sessionId: string | null;
  runId: string;
}

export interface ChatRunError {
  message: string;
  code?: string;
  retryable?: boolean;
}

export interface SessionRunState extends ChatRunAddress {
  /** Monotonic turn number for checkpoint/journal reconciliation. */
  turnRevision: number;
  phase: ChatRunPhase;
  startedAt: number;
  completedAt?: number;
  error?: ChatRunError;
  pendingApprovalIds: string[];
  pendingUserInputIds: string[];
  revision: number;
}

export type ChatRunTransition =
  | ({ type: 'start'; at: number } & ChatRunAddress)
  | ({ type: 'approvalRequested'; requestId: string } & ChatRunAddress)
  | ({ type: 'approvalSettled'; requestId: string } & ChatRunAddress)
  | ({ type: 'userInputRequested'; requestId: string } & ChatRunAddress)
  | ({ type: 'userInputSettled'; requestId: string } & ChatRunAddress)
  | ({ type: 'finalizing' } & ChatRunAddress)
  | ({ type: 'completed'; at: number } & ChatRunAddress)
  | ({ type: 'failed'; at: number; error: ChatRunError } & ChatRunAddress)
  | ({ type: 'interrupted'; at: number } & ChatRunAddress);

export const TERMINAL_RUN_PHASES: ReadonlySet<ChatRunPhase> = new Set([
  'completed',
  'failed',
  'interrupted',
]);
