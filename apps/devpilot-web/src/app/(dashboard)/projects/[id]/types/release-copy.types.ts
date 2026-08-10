export type ReleaseExecutionStatus =
  | 'created'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'cancelled'
  | 'blocked'
  | 'pending'
  | 'awaiting_approval';

export type ReleaseApprovalStatus = 'pending' | 'approved' | 'rejected' | 'canceled' | 'cancelled';

export type ReleaseEnvironmentRole = 'staging' | 'production';

export type EnvironmentVersionKind = 'deploy' | 'upgrade' | 'recovery';
