import type { ServerExecutionSupervisorSnapshot } from './supervisor';

const agentBlockingReasonLabels: Record<string, string> = {
  agent_executor_disabled: '执行器未启用',
  dispatcher_not_configured: '调度器未配置',
  heartbeat_stale: '心跳陈旧',
  heartbeat_unknown: '心跳未知',
  missing_heartbeat: '心跳缺失',
  server_offline: '服务器离线',
};

const agentRuntimeHealthLabels: Record<string, string> = {
  ready: '就绪',
  degraded: '降级',
  stale: '陈旧',
  unknown: '未知',
  missing: '缺失',
};

const agentRuntimeHealthReasonLabels: Record<string, string> = {
  agent_status_degraded: 'Agent 降级',
  heartbeat_expired: '心跳已过期',
  heartbeat_expiring_soon: '心跳即将过期',
  heartbeat_expiry_unknown: '心跳过期时间未知',
  heartbeat_missing: '心跳缺失',
  runtime_online: '运行时在线',
};

const agentLifecycleStateLabels: Record<string, string> = {
  ready: '就绪',
  degraded: '降级',
  blocked: '阻塞',
  disabled: '未启用',
};

const agentLifecycleReasonLabels: Record<string, string> = {
  agent_executor_disabled: '执行器未启用',
  agent_runtime_disabled: '运行时未启用',
  agent_target_selection_disabled: '目标选择未启用',
  agent_targets_available: '目标就绪',
  blocked_agent_jobs: '存在阻塞任务',
  configure_agent_dispatcher: '需配置调度器',
  dispatcher_not_configured: '调度器未配置',
  dispatcher_ready: '调度器就绪',
  heartbeat_disabled: '心跳未启用',
  heartbeat_runtime_ready: '心跳运行时就绪',
  heartbeat_online: '心跳在线',
  heartbeat_stale: '心跳陈旧',
  heartbeat_token_missing: '心跳令牌缺失',
  agent_queue_demand_visible: 'Agent 需求可见',
  agent_queue_backlog_ready: 'Agent 队列就绪',
  agent_queue_idle: 'Agent 队列空闲',
  agent_runtime_ready: 'Agent 运行时就绪',
  execution_audit_idle: '审计空闲',
  execution_audit_not_seen: '审计不可见',
  execution_audit_risk_present: '审计存在风险',
  execution_audit_visible: '审计可见',
  failed_agent_jobs: '存在失败任务',
  missing_runtime_heartbeat: '运行时心跳缺失',
  missing_next_agent_job_sample: '缺少下一任务样本',
  no_agent_capability: '无 Agent 能力',
  no_agent_capable_servers: '无 Agent 服务器',
  no_agent_task_pull_demand: '无拉取需求',
  no_live_dispatch_ready_servers: '无实时就绪服务器',
  no_runtime_heartbeat_online: '无在线心跳',
  preflight_ready: '预检就绪',
  queue_worker_disabled_with_agent_jobs: '队列 Worker 未启用',
  queue_worker_enabled: '队列 Worker 已启用',
  queue_worker_idle: '队列空闲',
  runtime_health_issue: '运行时异常',
  stale_agent_running_jobs: '存在陈旧任务',
  task_pull_claim_not_implemented: '认领未实现',
  task_pull_contract_disabled: '拉取契约未启用',
  task_pull_contract_pending: '拉取契约待就绪',
  task_pull_contract_readiness_visible: '拉取契约可见',
  task_pull_disabled: '任务拉取未启用',
  task_pull_endpoint_not_implemented: '拉取端点未实现',
  task_pull_readiness_disabled: '拉取就绪未启用',
  task_pull_readiness_ready: '拉取就绪',
  task_pull_runtime_ready: '运行时就绪',
};

const agentLifecycleActionLabels: Record<string, string> = {
  align_live_dispatch_ready_servers: '对齐实时就绪服务器',
  configure_agent_dispatcher: '配置调度器',
  configure_agent_heartbeat_token: '配置心跳令牌',
  enable_agent_executor: '启用执行器',
  enable_agent_heartbeat: '启用心跳',
  enable_agent_target_selection: '启用目标选择',
  enable_agent_task_pull_after_claim_design: '认领设计后启用拉取',
  enable_agent_task_pull_contract: '启用拉取契约',
  enable_queue_worker: '启用队列 Worker',
  design_agent_task_pull_endpoint: '设计拉取端点',
  implement_agent_task_claim: '实现任务认领',
  inspect_agent_runtime_health: '检查运行时健康',
  inspect_agent_job_queue_ordering: '检查任务队列',
  inspect_blocked_agent_jobs: '检查阻塞任务',
  inspect_execution_audit_events: '检查审计事件',
  inspect_failed_agent_jobs: '检查失败任务',
  ready_for_agent_runtime_lifecycle: '运行生命周期就绪',
  ready_for_agent_task_pull_design: '拉取设计就绪',
  recover_stale_agent_jobs: '恢复陈旧任务',
  register_agent_capability: '注册 Agent 能力',
  register_agent_capable_servers: '注册 Agent 服务器',
  roll_out_missing_agent_heartbeats: '补齐心跳',
  start_agent_heartbeat_runtime: '启动心跳运行时',
  wait_for_agent_task_pull_demand: '等待拉取需求',
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
