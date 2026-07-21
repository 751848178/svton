import type { ServerExecutionSupervisorSnapshot } from './supervisor';
import { formatRuntimeSeconds } from './supervisor-agent-format.utils';

const remoteOrphanStateLabels: Record<string, string> = {
  ready: '就绪',
  degraded: '降级',
  blocked: '阻塞',
  idle: '空闲',
};

const remoteOrphanReasonLabels: Record<string, string> = {
  expired_worker_owner: 'Owner 已过期',
  invalid_remote_execution_session: '远端会话无效',
  missing_remote_execution_session: '远端会话缺失',
  no_recoverable_remote_sessions: '无可恢复远端会话',
  no_remote_sessions_to_cleanup: '无清理目标',
  no_stale_remote_orphans: '无陈旧远端孤儿',
  no_stale_running_jobs: '无陈旧任务',
  recovery_batch_below_stale_jobs: '恢复批量不足',
  remote_cleanup_disabled_with_recoverable_sessions: '清理未启用且有会话',
  remote_cleanup_failed: '远端清理失败',
  remote_orphan_governance_ready: '治理就绪',
  remote_owner_state_ready: 'Owner 状态就绪',
  remote_sessions_tracked: '会话已跟踪',
  stale_jobs_scan_truncated: '扫描被截断',
  stale_remote_cleanup_enabled: '清理已启用',
  stale_recovery_batch_ready: '恢复批量就绪',
  stale_worker_owner: 'Owner 陈旧',
  unowned_stale_running_jobs: '存在无 Owner 陈旧任务',
};

const remoteOrphanActionLabels: Record<string, string> = {
  enable_stale_remote_cleanup: '启用陈旧清理',
  expand_stale_job_scan: '扩大陈旧扫描',
  inspect_failed_remote_cleanup: '检查清理失败',
  inspect_remote_execution_metadata: '检查远端元数据',
  inspect_unowned_running_jobs: '检查无 Owner 任务',
  inspect_worker_owners: '检查 Worker Owner',
  monitor_stale_remote_orphans: '监控远端孤儿',
  ready_for_remote_orphan_governance: '孤儿治理就绪',
  recover_expired_worker_owner: '恢复过期 Owner',
  tune_stale_recovery_batch: '调整恢复批量',
};

const executionAuditActionLabels: Record<string, string> = {
  'server_execution_job.agent_dispatch': 'Agent 投递',
  'server_execution_job.cancel': '取消任务',
  'server_execution_job.cancel.request': '取消请求',
  'server_execution_job.process_next': '处理下一任务',
  'server_execution_job.read': '读取任务',
  'server_execution_job.recover_stale': '恢复陈旧任务',
  'server_execution_job.retry.inline': '立即重试',
  'server_execution_job.retry.queue': '队列重试',
};

const auditRiskLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export function readRemoteOrphanStatus(state: string) {
  if (state === 'blocked') return 'blocked';
  if (state === 'degraded') return 'blocked';
  if (state === 'ready') return 'running';
  return 'queued';
}

export function formatRemoteOrphanState(state: string) {
  return remoteOrphanStateLabels[state] || state;
}

export function formatRemoteOrphanReason(reason: string) {
  return remoteOrphanReasonLabels[reason] || reason;
}

export function formatRemoteOrphanAction(action: string) {
  return remoteOrphanActionLabels[action] || action;
}

export function readExecutionAuditStatus(
  auditVisibility: ServerExecutionSupervisorSnapshot['executionAuditVisibility'],
) {
  if (auditVisibility.failedRecent > 0) return 'failed';
  if (auditVisibility.blockedRecent > 0 || auditVisibility.highRiskRecent > 0) return 'blocked';
  if (auditVisibility.totalRecent > 0) return 'completed';
  return 'queued';
}

export function formatExecutionAuditAction(action: string) {
  return executionAuditActionLabels[action] || action;
}

export function formatAuditRisk(risk: string) {
  return auditRiskLabels[risk] || risk;
}

export function formatNullableRuntimeSeconds(value?: number | null) {
  return value === null ? '-' : formatRuntimeSeconds(value);
}
