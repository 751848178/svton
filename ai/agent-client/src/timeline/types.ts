import type {
  ToolApprovalDecision,
  ToolApprovalSettlementDecision,
} from '@svton/agent-core';
import type { TimelineUsageContribution, TimelineUsageSnapshot } from './usage.types';

export type TimelineStatus =
  | 'pending'
  | 'running'
  | 'awaitingApproval'
  | 'completed'
  | 'failed'
  | 'declined'
  | 'cancelled'
  | 'interrupted';

export type TimelineTerminalStatus = Exclude<
  TimelineStatus,
  'pending' | 'running' | 'awaitingApproval'
>;

export type TimelineLane = 'process' | 'decision' | 'outcome';
export type TimelineTurnStatus = 'running' | 'completed' | 'failed' | 'interrupted';
export type TimelineCopyTarget =
  | 'result'
  | 'stdout'
  | 'stderr'
  | 'command'
  | 'diagnostic'
  | 'diff'
  | 'path';

export interface TimelineRetryDescriptor {
  kind: 'message';
  messageId: string;
}

export interface TimelineProgressEntry {
  id: string;
  text: string;
  createdAt: number;
}

export interface TimelineItemBase {
  id: string;
  sessionId: string;
  turnId: string;
  lane: TimelineLane;
  status: TimelineStatus;
  title: string;
  summary?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  revision: number;
}

export interface ToolExecutionTimelineItem extends TimelineItemBase {
  kind: 'toolExecution';
  toolName: string;
  arguments: Record<string, unknown>;
  progress: TimelineProgressEntry[];
  result?: string;
  retry?: TimelineRetryDescriptor;
}

export interface CommandExecutionTimelineItem extends TimelineItemBase {
  kind: 'commandExecution';
  toolName: string;
  command?: string;
  cwd?: string;
  progress: TimelineProgressEntry[];
  result?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  signal?: string;
  timedOut?: boolean;
  retry?: TimelineRetryDescriptor;
  terminalReference?: string;
}

export interface DiagnosticTimelineItem extends TimelineItemBase {
  kind: 'warning' | 'error';
  code?: string;
  diagnostic: string;
  retry?: TimelineRetryDescriptor;
}

export interface FileTimelineChange {
  sourceCallId: string;
  path: string;
  changeType: 'create' | 'modify' | 'delete';
  status: TimelineStatus;
  diff?: string;
}

export interface FileOutcomeTimelineItem extends TimelineItemBase {
  kind: 'fileOutcome';
  scope: 'file' | 'turn';
  sourceCallIds: string[];
  changes: FileTimelineChange[];
  detail?: string;
}

export interface ApprovalDecisionTimelineItem extends TimelineItemBase {
  kind: 'approvalDecision';
  requestId: string;
  itemId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  decisions: ToolApprovalDecision[];
  decision?: ToolApprovalSettlementDecision;
}

export type TimelineItem =
  | ToolExecutionTimelineItem
  | CommandExecutionTimelineItem
  | FileOutcomeTimelineItem
  | ApprovalDecisionTimelineItem
  | DiagnosticTimelineItem;

export interface TimelineTurn {
  version: 1;
  sessionId: string;
  turnId: string;
  status: TimelineTurnStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  usage?: TimelineUsageSnapshot;
  usageResponseKeys?: string[];
  items: TimelineItem[];
  revision: number;
}

interface TimelineActionOwner {
  sessionId: string;
  turnId: string;
  at: number;
}

export type TimelineAction = TimelineActionOwner & (
  | {
      type: 'start';
      item: ToolExecutionTimelineItem | CommandExecutionTimelineItem | FileOutcomeTimelineItem;
    }
  | { type: 'requestApproval'; item: ApprovalDecisionTimelineItem }
  | {
      type: 'settleApproval';
      requestId: string;
      decision: ToolApprovalSettlementDecision;
    }
  | { type: 'update'; id: string; progress: TimelineProgressEntry }
  | {
      type: 'finish';
      id: string;
      status: TimelineTerminalStatus;
      title: string;
      summary?: string;
      result?: string;
      command?: Partial<Pick<CommandExecutionTimelineItem,
        'command' | 'cwd' | 'stdout' | 'stderr' | 'exitCode' | 'signal' | 'timedOut'
        | 'durationMs' | 'terminalReference'>>;
      retry?: TimelineRetryDescriptor;
    }
  | { type: 'addOutcome'; item: DiagnosticTimelineItem }
  | { type: 'captureUsage'; contributions: TimelineUsageContribution[]; fallbackOnly?: boolean }
  | {
      type: 'finishFileOutcome';
      id: string;
      status: TimelineTerminalStatus;
      title: string;
      detail?: string;
      diff?: string;
    }
  | { type: 'completeTurn'; durationMs?: number }
  | { type: 'failTurn'; item: DiagnosticTimelineItem; durationMs?: number }
  | { type: 'interruptTurn' }
);
