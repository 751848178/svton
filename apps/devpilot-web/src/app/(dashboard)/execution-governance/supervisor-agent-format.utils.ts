import type { ServerExecutionSupervisorSnapshot } from './supervisor';

const agentBlockingReasonLabels: Record<string, string> = {
  agent_executor_disabled: 'executor off',
  dispatcher_not_configured: 'dispatcher missing',
  heartbeat_stale: 'heartbeat stale',
  heartbeat_unknown: 'heartbeat unknown',
  missing_heartbeat: 'heartbeat missing',
  server_offline: 'server offline',
};

const agentRuntimeHealthLabels: Record<string, string> = {
  ready: 'ready',
  degraded: 'degraded',
  stale: 'stale',
  unknown: 'unknown',
  missing: 'missing',
};

const agentRuntimeHealthReasonLabels: Record<string, string> = {
  agent_status_degraded: 'agent degraded',
  heartbeat_expired: 'heartbeat expired',
  heartbeat_expiring_soon: 'heartbeat expiring',
  heartbeat_expiry_unknown: 'heartbeat expiry unknown',
  heartbeat_missing: 'heartbeat missing',
  runtime_online: 'runtime online',
};

const agentLifecycleStateLabels: Record<string, string> = {
  ready: 'ready',
  degraded: 'degraded',
  blocked: 'blocked',
  disabled: 'disabled',
};

const agentLifecycleReasonLabels: Record<string, string> = {
  agent_executor_disabled: 'executor off',
  agent_runtime_disabled: 'runtime off',
  agent_target_selection_disabled: 'target off',
  agent_targets_available: 'targets ready',
  blocked_agent_jobs: 'blocked jobs',
  configure_agent_dispatcher: 'configure dispatcher',
  dispatcher_not_configured: 'dispatcher missing',
  dispatcher_ready: 'dispatcher ready',
  heartbeat_disabled: 'heartbeat off',
  heartbeat_runtime_ready: 'heartbeat ready',
  heartbeat_online: 'heartbeat online',
  heartbeat_stale: 'heartbeat stale',
  heartbeat_token_missing: 'heartbeat token missing',
  agent_queue_demand_visible: 'agent demand visible',
  agent_queue_backlog_ready: 'agent queue ready',
  agent_queue_idle: 'agent queue idle',
  agent_runtime_ready: 'agent runtime ready',
  execution_audit_idle: 'audit idle',
  execution_audit_not_seen: 'audit not seen',
  execution_audit_risk_present: 'audit risk',
  execution_audit_visible: 'audit visible',
  failed_agent_jobs: 'failed jobs',
  missing_runtime_heartbeat: 'heartbeat missing',
  missing_next_agent_job_sample: 'missing next job',
  no_agent_capability: 'no agent capability',
  no_agent_capable_servers: 'no agent servers',
  no_agent_task_pull_demand: 'no pull demand',
  no_live_dispatch_ready_servers: 'no live-ready servers',
  no_runtime_heartbeat_online: 'no online heartbeat',
  preflight_ready: 'preflight ready',
  queue_worker_disabled_with_agent_jobs: 'queue worker off',
  queue_worker_enabled: 'queue worker on',
  queue_worker_idle: 'queue idle',
  runtime_health_issue: 'runtime issues',
  stale_agent_running_jobs: 'stale jobs',
  task_pull_claim_not_implemented: 'claim not implemented',
  task_pull_contract_disabled: 'pull contract off',
  task_pull_contract_pending: 'pull contract pending',
  task_pull_contract_readiness_visible: 'pull contract visible',
  task_pull_disabled: 'task pull off',
  task_pull_endpoint_not_implemented: 'pull endpoint missing',
  task_pull_readiness_disabled: 'pull readiness off',
  task_pull_readiness_ready: 'pull readiness ready',
  task_pull_runtime_ready: 'runtime ready',
};

const agentLifecycleActionLabels: Record<string, string> = {
  align_live_dispatch_ready_servers: 'align dispatch-ready servers',
  configure_agent_dispatcher: 'configure dispatcher',
  configure_agent_heartbeat_token: 'configure heartbeat token',
  enable_agent_executor: 'enable executor',
  enable_agent_heartbeat: 'enable heartbeat',
  enable_agent_target_selection: 'enable target selection',
  enable_agent_task_pull_after_claim_design: 'enable after claim design',
  enable_agent_task_pull_contract: 'enable pull contract',
  enable_queue_worker: 'enable queue worker',
  design_agent_task_pull_endpoint: 'design task-pull endpoint',
  implement_agent_task_claim: 'implement task claim',
  inspect_agent_runtime_health: 'inspect runtime health',
  inspect_agent_job_queue_ordering: 'inspect job queue',
  inspect_blocked_agent_jobs: 'inspect blocked jobs',
  inspect_execution_audit_events: 'inspect audit events',
  inspect_failed_agent_jobs: 'inspect failed jobs',
  ready_for_agent_runtime_lifecycle: 'ready for runtime lifecycle',
  ready_for_agent_task_pull_design: 'ready for task-pull design',
  recover_stale_agent_jobs: 'recover stale jobs',
  register_agent_capability: 'register agent capability',
  register_agent_capable_servers: 'register agent servers',
  roll_out_missing_agent_heartbeats: 'roll out heartbeats',
  start_agent_heartbeat_runtime: 'start heartbeat runtime',
  wait_for_agent_task_pull_demand: 'wait for pull demand',
};

export function readAgentFleetStatus(
  server: ServerExecutionSupervisorSnapshot['agent']['fleet']['items'][number],
) {
  if (server.readiness.liveDispatchReady) return 'running';
  if (server.readiness.targetReady) return 'queued';
  return 'blocked';
}

export function formatAgentBlockingReasons(reasons: string[]) {
  return reasons.map((reason) => agentBlockingReasonLabels[reason] || reason).join(' · ');
}

export function formatAgentRuntimeHealthState(state: string) {
  return agentRuntimeHealthLabels[state] || state;
}

export function formatAgentRuntimeHealthReason(reason: string) {
  return agentRuntimeHealthReasonLabels[reason] || reason;
}

export function formatAgentLifecycleState(state: string) {
  return agentLifecycleStateLabels[state] || state;
}

export function formatAgentLifecycleReason(reason: string) {
  return agentLifecycleReasonLabels[reason] || reason;
}

export function formatAgentLifecycleAction(action: string) {
  return agentLifecycleActionLabels[action] || action;
}

export function readAgentLifecycleStatus(state: string) {
  if (state === 'ready') return 'running';
  if (state === 'degraded') return 'queued';
  if (state === 'disabled' || state === 'idle') return 'idle';
  return 'blocked';
}

export function formatRuntimeSeconds(value?: number) {
  if (value === undefined) return '-';
  return value < 0 ? `-${Math.abs(value)}s` : `${value}s`;
}
