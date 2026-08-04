export const RELEASE_ORDER_LIFECYCLE_STATUSES = [
  'draft',
  'building',
  'staging',
  'awaiting_approval',
  'production',
  'succeeded',
  'failed',
  'withdrawn',
] as const;

export type ReleaseOrderPersistedStatus =
  | 'draft'
  | 'active'
  | 'succeeded'
  | 'failed'
  | 'canceled';
export type ReleaseOrderLifecycleStatus = (typeof RELEASE_ORDER_LIFECYCLE_STATUSES)[number];
export type ReleaseOrderLifecyclePhase = 'preflight' | 'build' | 'staging' | 'production';

export interface ReleaseOrderLifecycle {
  status: ReleaseOrderLifecycleStatus;
  phase: ReleaseOrderLifecyclePhase;
  sourceType: 'order_created' | 'build_run' | 'deployment_run' | 'release_run' | 'withdrawal';
  sourceId: string;
  sourceStatus: string;
  occurredAt: string;
  failureKind?: 'failed' | 'blocked' | 'canceled' | 'evidence_mismatch';
}
