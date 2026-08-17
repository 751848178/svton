import { TimelineStatusIcon, type TranscriptStatus } from '../timeline/TimelineStatusIcon';

function normalizeStatus(status: string): TranscriptStatus {
  if (status === 'completed' || status === 'failed' || status === 'skipped' || status === 'pending') {
    return status;
  }
  if (status === 'in_progress' || status === 'running') return 'in_progress';
  return 'unknown';
}

export function PlanStepStatusIcon({ status }: { status: string }) {
  return <TimelineStatusIcon status={normalizeStatus(status)} />;
}

export function planStepSurface(status: string): string {
  if (status === 'completed') return 'bg-status-success/10';
  if (status === 'failed') return 'bg-destructive/10';
  if (status === 'in_progress' || status === 'running') return 'bg-status-info/10';
  if (status === 'skipped') return 'bg-muted';
  return '';
}
