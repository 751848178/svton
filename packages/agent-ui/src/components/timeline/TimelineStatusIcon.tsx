import type { ComponentType } from 'react';
import {
  CloseIcon,
  CompletedIcon,
  ErrorIcon,
  PendingIcon,
  RunningIcon,
  WarningIcon,
  cn,
  type SvtonIconProps,
} from '@svton/ui';

export type TranscriptStatus =
  | 'pending' | 'pending_approval' | 'awaitingApproval' | 'running' | 'in_progress'
  | 'completed' | 'success' | 'done' | 'failed' | 'error'
  | 'declined' | 'cancelled' | 'interrupted' | 'warning' | 'skipped' | 'unknown';

const VIEW: Record<TranscriptStatus, {
  icon: ComponentType<SvtonIconProps>;
  className: string;
}> = {
  pending: { icon: PendingIcon, className: 'text-muted-foreground' },
  pending_approval: { icon: WarningIcon, className: 'text-status-warning' },
  awaitingApproval: { icon: WarningIcon, className: 'text-status-warning' },
  running: { icon: RunningIcon, className: 'animate-spin text-status-info motion-reduce:animate-none' },
  in_progress: { icon: RunningIcon, className: 'animate-spin text-status-info motion-reduce:animate-none' },
  completed: { icon: CompletedIcon, className: 'text-status-success' },
  success: { icon: CompletedIcon, className: 'text-status-success' },
  done: { icon: CompletedIcon, className: 'text-status-success' },
  failed: { icon: ErrorIcon, className: 'text-destructive' },
  error: { icon: ErrorIcon, className: 'text-destructive' },
  declined: { icon: CloseIcon, className: 'text-destructive' },
  cancelled: { icon: CloseIcon, className: 'text-status-warning' },
  interrupted: { icon: WarningIcon, className: 'text-status-warning' },
  warning: { icon: WarningIcon, className: 'text-status-warning' },
  skipped: { icon: CloseIcon, className: 'text-muted-foreground' },
  unknown: { icon: PendingIcon, className: 'text-muted-foreground' },
};

export function TimelineStatusIcon({
  status, size = 14, className,
}: { status: TranscriptStatus; size?: number; className?: string }) {
  const view = VIEW[status];
  const Icon = view.icon;
  return (
    <Icon
      size={size}
      className={cn('shrink-0', view.className, className)}
      aria-hidden="true"
      data-status-icon={status}
    />
  );
}
