const workerInventoryStateLabels: Record<string, string> = {
  running: 'running',
  degraded: 'degraded',
  blocked: 'blocked',
  idle: 'idle',
};

const workerInventoryReasonLabels: Record<string, string> = {
  active_worker_owner: 'active owner',
  expired_worker_owner: 'expired owner',
  no_active_worker_owner: 'no active owner',
  queue_worker_disabled: 'queue worker off',
  queue_worker_enabled: 'queue worker on',
  stale_worker_owner: 'stale owner',
};

const queueCoordinationStateLabels: Record<string, string> = {
  ready: 'ready',
  degraded: 'degraded',
  blocked: 'blocked',
  idle: 'idle',
};

const queueCoordinationReasonLabels: Record<string, string> = {
  active_worker_owner: 'active owner',
  blocked_jobs: 'blocked jobs',
  blocked_jobs_present: 'blocked jobs',
  expired_worker_owner: 'expired owner',
  no_active_worker_owner: 'no active owner',
  no_running_job_owner: 'no running owner',
  processing_queue: 'processing queue',
  queue_backlog_active: 'backlog active',
  queue_coordination_idle: 'coordination idle',
  queue_coordination_ready: 'coordination ready',
  queue_idle: 'queue idle',
  queue_worker_disabled: 'queue worker off',
  queue_worker_disabled_with_backlog: 'worker off with backlog',
  queue_worker_enabled: 'queue worker on',
  running_jobs_active: 'running jobs',
  stale_remote_cleanup_disabled: 'remote cleanup off',
  stale_remote_cleanup_disabled_with_stale_jobs: 'remote cleanup off',
  stale_recovery_ready: 'recovery ready',
  stale_running_jobs: 'stale jobs',
  stale_worker_owner: 'stale owner',
  unowned_running_jobs: 'unowned running',
};

const queueCoordinationActionLabels: Record<string, string> = {
  enable_queue_worker: 'enable queue worker',
  enable_stale_remote_cleanup: 'enable stale cleanup',
  inspect_blocked_jobs: 'inspect blocked jobs',
  inspect_unowned_running_jobs: 'inspect unowned jobs',
  inspect_worker_owners: 'inspect worker owners',
  inspect_worker_startup: 'inspect worker startup',
  monitor_queue_pressure: 'monitor queue pressure',
  ready_for_multi_instance_queue_coordination: 'ready for coordination',
  recover_expired_worker_owner: 'recover expired owner',
  recover_stale_jobs: 'recover stale jobs',
};

export function readWorkerInventoryStatus(state: string) {
  if (state === 'blocked') return 'blocked';
  if (state === 'degraded') return 'blocked';
  if (state === 'running') return 'running';
  return 'queued';
}

export function formatWorkerInventoryState(state: string) {
  return workerInventoryStateLabels[state] || state;
}

export function formatWorkerInventoryReason(reason: string) {
  return workerInventoryReasonLabels[reason] || reason;
}

export function readQueueCoordinationStatus(state: string) {
  if (state === 'blocked') return 'blocked';
  if (state === 'degraded') return 'blocked';
  if (state === 'ready') return 'running';
  return 'queued';
}

export function formatQueueCoordinationState(state: string) {
  return queueCoordinationStateLabels[state] || state;
}

export function formatQueueCoordinationReason(reason: string) {
  return queueCoordinationReasonLabels[reason] || reason;
}

export function formatQueueCoordinationAction(action: string) {
  return queueCoordinationActionLabels[action] || action;
}
