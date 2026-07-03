import type { ServerExecutionSupervisorSnapshot } from './supervisor';
import { formatRuntimeSeconds } from './supervisor-agent-format.utils';

const remoteOrphanStateLabels: Record<string, string> = {
  ready: 'ready',
  degraded: 'degraded',
  blocked: 'blocked',
  idle: 'idle',
};

const remoteOrphanReasonLabels: Record<string, string> = {
  expired_worker_owner: 'expired owner',
  invalid_remote_execution_session: 'invalid session',
  missing_remote_execution_session: 'missing session',
  no_recoverable_remote_sessions: 'no remote sessions',
  no_remote_sessions_to_cleanup: 'no cleanup target',
  no_stale_remote_orphans: 'no stale remote orphans',
  no_stale_running_jobs: 'no stale jobs',
  recovery_batch_below_stale_jobs: 'batch below stale jobs',
  remote_cleanup_disabled_with_recoverable_sessions: 'cleanup off with sessions',
  remote_cleanup_failed: 'cleanup failed',
  remote_orphan_governance_ready: 'governance ready',
  remote_owner_state_ready: 'owner state ready',
  remote_sessions_tracked: 'sessions tracked',
  stale_jobs_scan_truncated: 'scan truncated',
  stale_remote_cleanup_enabled: 'cleanup enabled',
  stale_recovery_batch_ready: 'recovery batch ready',
  stale_worker_owner: 'stale owner',
  unowned_stale_running_jobs: 'unowned stale jobs',
};

const remoteOrphanActionLabels: Record<string, string> = {
  enable_stale_remote_cleanup: 'enable stale cleanup',
  expand_stale_job_scan: 'expand stale scan',
  inspect_failed_remote_cleanup: 'inspect cleanup failures',
  inspect_remote_execution_metadata: 'inspect remote metadata',
  inspect_unowned_running_jobs: 'inspect unowned jobs',
  inspect_worker_owners: 'inspect worker owners',
  monitor_stale_remote_orphans: 'monitor stale orphans',
  ready_for_remote_orphan_governance: 'ready for governance',
  recover_expired_worker_owner: 'recover expired owner',
  tune_stale_recovery_batch: 'tune recovery batch',
};

const executionAuditActionLabels: Record<string, string> = {
  'server_execution_job.agent_dispatch': 'agent dispatch',
  'server_execution_job.cancel': 'cancel job',
  'server_execution_job.cancel.request': 'cancel request',
  'server_execution_job.process_next': 'process next',
  'server_execution_job.read': 'read job',
  'server_execution_job.recover_stale': 'recover stale',
  'server_execution_job.retry.inline': 'retry inline',
  'server_execution_job.retry.queue': 'retry queued',
};

const auditRiskLabels: Record<string, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
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
