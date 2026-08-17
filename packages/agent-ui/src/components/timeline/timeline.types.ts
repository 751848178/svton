export type TimelineStatusView =
  | 'pending'
  | 'running'
  | 'awaitingApproval'
  | 'completed'
  | 'failed'
  | 'declined'
  | 'cancelled'
  | 'interrupted';

export interface TimelineRetryView {
  kind: 'message';
  messageId: string;
}

export interface TimelineProgressView {
  id: string;
  text: string;
  createdAt: number;
}

interface TimelineItemViewBase {
  id: string;
  sessionId: string;
  turnId: string;
  lane: 'process' | 'decision' | 'outcome';
  status: TimelineStatusView;
  title: string;
  summary?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  revision: number;
}

export interface ToolExecutionItemView extends TimelineItemViewBase {
  kind: 'toolExecution';
  toolName: string;
  arguments: Record<string, unknown>;
  progress: TimelineProgressView[];
  result?: string;
  retry?: TimelineRetryView;
}

export interface CommandExecutionItemView extends TimelineItemViewBase {
  kind: 'commandExecution';
  toolName: string;
  command?: string;
  cwd?: string;
  progress: TimelineProgressView[];
  result?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  signal?: string;
  timedOut?: boolean;
  retry?: TimelineRetryView;
  terminalReference?: string;
}

export interface DiagnosticItemView extends TimelineItemViewBase {
  kind: 'warning' | 'error';
  code?: string;
  diagnostic: string;
  retry?: TimelineRetryView;
}

export interface FileChangeItemView {
  sourceCallId: string;
  path: string;
  changeType: 'create' | 'modify' | 'delete';
  status: TimelineStatusView;
  diff?: string;
}

export interface FileOutcomeItemView extends TimelineItemViewBase {
  kind: 'fileOutcome';
  scope: 'file' | 'turn';
  sourceCallIds: string[];
  changes: FileChangeItemView[];
  detail?: string;
}

export interface ApprovalDecisionItemView extends TimelineItemViewBase {
  kind: 'approvalDecision';
  requestId: string;
  itemId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  decisions: Array<'accept' | 'acceptForSession' | 'decline' | 'cancel'>;
  decision?: 'accept' | 'acceptForSession' | 'decline' | 'cancel' | 'interrupted';
}

export type TimelineItemView =
  | ToolExecutionItemView
  | CommandExecutionItemView
  | FileOutcomeItemView
  | ApprovalDecisionItemView
  | DiagnosticItemView;

export interface TimelineTurnView {
  version: 1;
  sessionId: string;
  turnId: string;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  items: TimelineItemView[];
  revision: number;
}

export type TimelineCopyTarget =
  | 'result'
  | 'stdout'
  | 'stderr'
  | 'command'
  | 'diagnostic'
  | 'diff'
  | 'path';

export type TimelineHostIntent =
  | { type: 'copy'; target: TimelineCopyTarget; value: string }
  | { type: 'retry'; descriptor: TimelineRetryView }
  | { type: 'open'; target: 'path' | 'reference' | 'diff'; value: string }
  | { type: 'openTerminal'; terminalReference: string };

export interface TimelineHostIntentResult {
  status: 'handled' | 'unavailable';
  message?: string;
}

export type TimelineHostIntentHandler = (
  intent: TimelineHostIntent,
) => TimelineHostIntentResult | Promise<TimelineHostIntentResult>;

export interface TimelineHostCapabilities {
  openTerminal: boolean;
  openPath?: boolean;
}
