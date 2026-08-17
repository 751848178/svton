import type { TranslationKey } from '@svton/ui';
import type { TimelineStatusView } from './timeline.types';

const STATUS_KEYS: Record<TimelineStatusView, TranslationKey> = {
  pending: 'timeline.status.pending',
  running: 'timeline.status.running',
  awaitingApproval: 'timeline.status.awaitingApproval',
  completed: 'timeline.status.completed',
  failed: 'timeline.status.failed',
  declined: 'timeline.status.declined',
  cancelled: 'timeline.status.cancelled',
  interrupted: 'timeline.status.interrupted',
};

export function timelineStatusKey(status: TimelineStatusView): TranslationKey {
  return STATUS_KEYS[status];
}
