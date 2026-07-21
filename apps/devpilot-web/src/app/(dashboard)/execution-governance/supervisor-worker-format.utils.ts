const workerInventoryStateLabels: Record<string, string> = {
  running: '运行中',
  degraded: '降级',
  blocked: '阻塞',
  idle: '空闲',
};

const workerInventoryReasonLabels: Record<string, string> = {
  active_worker_owner: 'Owner 活跃',
  expired_worker_owner: 'Owner 已过期',
  no_active_worker_owner: '无活跃 Owner',
  queue_worker_disabled: '队列 Worker 未启用',
  queue_worker_enabled: '队列 Worker 已启用',
  stale_worker_owner: 'Owner 陈旧',
};

const queueCoordinationStateLabels: Record<string, string> = {
  ready: '就绪',
  degraded: '降级',
  blocked: '阻塞',
  idle: '空闲',
};

const queueCoordinationReasonLabels: Record<string, string> = {
  active_worker_owner: 'Owner 活跃',
  blocked_jobs: '存在阻塞任务',
  blocked_jobs_present: '存在阻塞任务',
  expired_worker_owner: 'Owner 已过期',
  no_active_worker_owner: '无活跃 Owner',
  no_running_job_owner: '无运行任务 Owner',
  processing_queue: '正在处理队列',
  queue_backlog_active: '队列存在积压',
  queue_coordination_idle: '协调空闲',
  queue_coordination_ready: '协调就绪',
  queue_idle: '队列空闲',
  queue_worker_disabled: '队列 Worker 未启用',
  queue_worker_disabled_with_backlog: 'Worker 未启用且有积压',
  queue_worker_enabled: '队列 Worker 已启用',
  running_jobs_active: '任务运行中',
  stale_remote_cleanup_disabled: '远端清理未启用',
  stale_remote_cleanup_disabled_with_stale_jobs: '远端清理未启用',
  stale_recovery_ready: '恢复就绪',
  stale_running_jobs: '存在陈旧任务',
  stale_worker_owner: 'Owner 陈旧',
  unowned_running_jobs: '存在无 Owner 任务',
};

const queueCoordinationActionLabels: Record<string, string> = {
  enable_queue_worker: '启用队列 Worker',
  enable_stale_remote_cleanup: '启用陈旧清理',
  inspect_blocked_jobs: '检查阻塞任务',
  inspect_unowned_running_jobs: '检查无 Owner 任务',
  inspect_worker_owners: '检查 Worker Owner',
  inspect_worker_startup: '检查 Worker 启动',
  monitor_queue_pressure: '监控队列压力',
  ready_for_multi_instance_queue_coordination: '多实例协调就绪',
  recover_expired_worker_owner: '恢复过期 Owner',
  recover_stale_jobs: '恢复陈旧任务',
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
