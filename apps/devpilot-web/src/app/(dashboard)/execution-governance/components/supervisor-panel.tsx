/**
 * Supervisor 面板
 *
 * 单一职责：渲染 queue worker、Agent readiness、worker owners 三列概览。
 */

import { LoadingState, EmptyState } from '@svton/ui';
import { Metric, SupervisorField, StatusBadge } from './ui-bits';
import { formatAgentSource, formatAgentRuntimeState, shortId, formatDate } from '../utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

interface SupervisorPanelProps {
  supervisor: ServerExecutionSupervisorSnapshot | null;
  loading: boolean;
  error: string;
}

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

export function SupervisorPanel({ supervisor, loading, error }: SupervisorPanelProps) {
  if (loading) return <LoadingState text="加载中..." />;
  if (!supervisor) {
    return <EmptyState text={error || 'Supervisor 状态不可用'} />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12">
        <Metric
          label="Ready"
          value={supervisor.queue.ready}
        />
        <Metric
          label="Scheduled"
          value={supervisor.queue.scheduled}
        />
        <Metric
          label="Running"
          value={supervisor.queue.running}
        />
        <Metric
          label="Stale"
          value={supervisor.queue.staleRunning}
        />
        <Metric
          label="Active lease"
          value={supervisor.leases.running}
        />
        <Metric
          label="Workers"
          value={supervisor.workers.length}
        />
        <Metric
          label="Worker owner"
          value={supervisor.workerInventory.owners.total}
        />
        <Metric
          label="Owner stale"
          value={supervisor.workerInventory.owners.stale}
        />
        <Metric
          label="Agent targets"
          value={supervisor.agent.capableServers}
        />
        <Metric
          label="Agent runtime"
          value={supervisor.agent.runtime.onlineServers}
        />
        <Metric
          label="Agent stale"
          value={supervisor.agent.runtime.staleServers}
        />
        <Metric
          label="Agent ready"
          value={supervisor.agent.jobs.ready}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <WorkerProcessCard supervisor={supervisor} />
        <AgentReadinessCard supervisor={supervisor} />
        <WorkerOwnersCard supervisor={supervisor} />
      </div>
    </>
  );
}

function WorkerProcessCard({ supervisor }: { supervisor: ServerExecutionSupervisorSnapshot }) {
  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">本进程</h3>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {supervisor.worker.workerId}
          </div>
        </div>
        <StatusBadge status={supervisor.worker.queueWorkerEnabled ? 'running' : 'blocked'} />
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label="处理队列"
          value={supervisor.worker.processingQueue ? '是' : '否'}
        />
        <SupervisorField
          label="取消令牌"
          value={String(supervisor.worker.runningCancellations)}
        />
        <SupervisorField
          label="批量大小"
          value={String(supervisor.worker.queueBatchSize)}
        />
        <SupervisorField
          label="轮询间隔"
          value={`${supervisor.worker.queueIntervalSeconds}s`}
        />
        <SupervisorField
          label="锁 TTL"
          value={`${supervisor.worker.queueLockTtlSeconds}s`}
        />
        <SupervisorField
          label="心跳间隔"
          value={`${supervisor.worker.queueHeartbeatSeconds}s`}
        />
        <SupervisorField
          label="取消轮询"
          value={`${supervisor.worker.cancellationPollSeconds}s`}
        />
        <SupervisorField
          label="远端追偿"
          value={supervisor.worker.staleRemoteCleanupEnabled ? '开启' : '关闭'}
        />
      </div>
      {supervisor.queue.nextQueuedJob ? (
        <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">下一任务</span>
          <span> · {supervisor.queue.nextQueuedJob.operationKey}</span>
          <span> · {supervisor.queue.nextQueuedJob.adapterKey}</span>
          <span> · {supervisor.queue.nextQueuedJob.server?.name || '未关联服务器'}</span>
        </div>
      ) : null}
    </div>
  );
}

function AgentReadinessCard({ supervisor }: { supervisor: ServerExecutionSupervisorSnapshot }) {
  const agent = supervisor.agent;
  const preflight = agent.lifecyclePreflight;
  const taskPull = agent.taskPullReadiness;
  const criticalBlockers = preflight.blockers.filter((blocker) => blocker.severity === 'critical').length;
  const warningBlockers = preflight.blockers.filter((blocker) => blocker.severity === 'warning').length;
  const taskPullCriticalBlockers = taskPull.blockers.filter((blocker) => blocker.severity === 'critical').length;
  const taskPullWarningBlockers = taskPull.blockers.filter((blocker) => blocker.severity === 'warning').length;

  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Agent readiness</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {agent.capableServers}/{agent.totalServers} servers
          </div>
        </div>
        <StatusBadge status={agent.targetSelectionEnabled ? 'running' : 'blocked'} />
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label="executor"
          value={agent.dispatcher.executorEnabled ? '开启' : '关闭'}
        />
        <SupervisorField
          label="dispatcher"
          value={agent.dispatcher.dispatcherConfigured ? '已配置' : '未配置'}
        />
        <SupervisorField
          label="timeout"
          value={`${agent.dispatcher.timeoutSeconds}s`}
        />
        <SupervisorField
          label="token"
          value={agent.dispatcher.tokenConfigured ? '已配置' : '未配置'}
        />
        <SupervisorField
          label="heartbeat"
          value={agent.runtime.heartbeatEnabled ? '开启' : '关闭'}
        />
        <SupervisorField
          label="hb token"
          value={agent.runtime.tokenConfigured ? '已配置' : '未配置'}
        />
        <SupervisorField
          label="services 来源"
          value={String(agent.serviceCapabilityServers)}
        />
        <SupervisorField
          label="tags 来源"
          value={String(agent.tagCapabilityServers)}
        />
        <SupervisorField
          label="在线可用"
          value={String(agent.onlineCapableServers)}
        />
        <SupervisorField
          label="runtime"
          value={`${agent.runtime.onlineServers}/${agent.runtime.staleServers}/${agent.runtime.unknownServers}`}
        />
        <SupervisorField
          label="runtime ready"
          value={`${agent.runtimeHealth.readyServers}/${agent.runtimeHealth.totalServers}`}
        />
        <SupervisorField
          label="runtime issues"
          value={`${agent.runtimeHealth.degradedServers}/${agent.runtimeHealth.staleServers}/${agent.runtimeHealth.missingHeartbeatServers}`}
        />
        <SupervisorField
          label="expiring soon"
          value={String(agent.runtimeHealth.expiringSoonServers)}
        />
        <SupervisorField
          label="状态分布"
          value={
            agent.statusCounts.length
              ? agent.statusCounts.map((i) => `${i.status}:${i.count}`).join(' · ')
              : '-'
          }
        />
        <SupervisorField
          label="fleet live-ready"
          value={`${agent.fleet.liveDispatchReadyServers}/${agent.fleet.totalServers}`}
        />
        <SupervisorField
          label="fleet pressure"
          value={`${agent.fleet.pressureServers}/${agent.fleet.scannedJobs}`}
        />
        <SupervisorField
          label="lifecycle"
          value={formatAgentLifecycleState(preflight.state)}
        />
        <SupervisorField
          label="preflight blockers"
          value={`${criticalBlockers}/${warningBlockers}`}
        />
        <SupervisorField
          label="task pull"
          value={formatAgentLifecycleState(taskPull.state)}
        />
        <SupervisorField
          label="pull blockers"
          value={`${taskPullCriticalBlockers}/${taskPullWarningBlockers}`}
        />
      </div>
      {agent.dispatcher.dispatcherUrl ? (
        <div className="mt-3 break-all font-mono text-xs text-muted-foreground">
          {agent.dispatcher.dispatcherUrl}
        </div>
      ) : null}

      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-foreground">Runtime lifecycle</h4>
          <StatusBadge status={readAgentLifecycleStatus(preflight.state)} />
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <SupervisorField
            label="preflight"
            value={`${formatAgentLifecycleState(preflight.state)} · ${formatAgentLifecycleReason(preflight.reason)}`}
          />
          <SupervisorField
            label="target"
            value={`${preflight.gates.targetSelection.capableServers}/${preflight.gates.targetSelection.onlineCapableServers} · ${formatAgentLifecycleReason(preflight.gates.targetSelection.reason)}`}
          />
          <SupervisorField
            label="heartbeat"
            value={`${preflight.gates.heartbeat.readyServers}/${preflight.gates.heartbeat.heartbeatServers} · ${formatAgentLifecycleReason(preflight.gates.heartbeat.reason)}`}
          />
          <SupervisorField
            label="dispatcher"
            value={`${preflight.gates.dispatcher.liveDispatchReadyServers} live · ${formatAgentLifecycleReason(preflight.gates.dispatcher.reason)}`}
          />
          <SupervisorField
            label="queue"
            value={`${preflight.gates.queueWorker.queuedJobs}/${preflight.gates.queueWorker.runningJobs}/${preflight.gates.queueWorker.blockedJobs} · ${formatAgentLifecycleReason(preflight.gates.queueWorker.reason)}`}
          />
          <SupervisorField
            label="pressure"
            value={`${preflight.pressure.servers}/${preflight.pressure.scannedJobs}`}
          />
        </div>

        {preflight.blockers.length > 0 ? (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {preflight.blockers.slice(0, 4).map((blocker) => (
              <div
                key={`${blocker.severity}-${blocker.reason}`}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{formatAgentLifecycleReason(blocker.reason)}</span>
                <span>{blocker.severity} · {blocker.count}</span>
              </div>
            ))}
          </div>
        ) : null}

        {preflight.nextSteps.length > 0 ? (
          <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
            {preflight.nextSteps.slice(0, 3).map((step) => (
              <div key={step.action}>
                {formatAgentLifecycleAction(step.action)} · {formatAgentLifecycleReason(step.reason)}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-foreground">Task pull readiness</h4>
          <StatusBadge status={readAgentLifecycleStatus(taskPull.state)} />
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <SupervisorField
            label="readiness"
            value={`${formatAgentLifecycleState(taskPull.state)} · ${formatAgentLifecycleReason(taskPull.reason)}`}
          />
          <SupervisorField
            label="runtime"
            value={`${taskPull.gates.runtime.readyServers}/${taskPull.gates.runtime.capableServers} · ${formatAgentLifecycleReason(taskPull.gates.runtime.reason)}`}
          />
          <SupervisorField
            label="queue"
            value={`${taskPull.gates.queue.readyJobs}/${taskPull.gates.queue.scheduledJobs}/${taskPull.gates.queue.runningJobs} · ${formatAgentLifecycleReason(taskPull.gates.queue.reason)}`}
          />
          <SupervisorField
            label="contract"
            value={formatAgentLifecycleReason(taskPull.gates.pullContract.reason)}
          />
          <SupervisorField
            label="audit"
            value={`${taskPull.gates.audit.totalRecent}/${taskPull.gates.audit.failedRecent + taskPull.gates.audit.blockedRecent + taskPull.gates.audit.highRiskRecent} · ${formatAgentLifecycleReason(taskPull.gates.audit.reason)}`}
          />
          <SupervisorField
            label="pressure"
            value={`${taskPull.pressure.readyJobs}/${taskPull.pressure.runningJobs}/${taskPull.pressure.blockedJobs}/${taskPull.pressure.failedJobs}`}
          />
        </div>

        {taskPull.samples.nextQueuedJob ? (
          <div className="mt-3 text-xs text-muted-foreground">
            next {shortId(taskPull.samples.nextQueuedJob.id)} · {taskPull.samples.nextQueuedJob.operationKey}
            {taskPull.samples.nextQueuedJob.server
              ? ` · ${taskPull.samples.nextQueuedJob.server.name}`
              : ''}
          </div>
        ) : null}

        {taskPull.blockers.length > 0 ? (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {taskPull.blockers.slice(0, 4).map((blocker) => (
              <div
                key={`${blocker.severity}-${blocker.reason}`}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{formatAgentLifecycleReason(blocker.reason)}</span>
                <span>{blocker.severity} · {blocker.count}</span>
              </div>
            ))}
          </div>
        ) : null}

        {taskPull.nextSteps.length > 0 ? (
          <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
            {taskPull.nextSteps.slice(0, 3).map((step) => (
              <div key={step.action}>
                {formatAgentLifecycleAction(step.action)} · {formatAgentLifecycleReason(step.reason)}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3">
        <h4 className="text-xs font-medium text-foreground">Agent jobs</h4>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <SupervisorField
            label="ready/scheduled"
            value={`${agent.jobs.ready}/${agent.jobs.scheduled}`}
          />
          <SupervisorField
            label="running/stale"
            value={`${agent.jobs.running}/${agent.jobs.staleRunning}`}
          />
          <SupervisorField
            label="blocked/failed"
            value={`${agent.jobs.blocked}/${agent.jobs.failed}`}
          />
          <SupervisorField
            label="cancelled"
            value={String(agent.jobs.cancelled)}
          />
        </div>
      </div>

      <div className="mt-4 border-t pt-3">
        <h4 className="text-xs font-medium text-foreground">Runtime health</h4>
        {agent.runtimeHealth.samples.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">runtime ready</div>
        ) : (
          <div className="mt-2 space-y-2">
            {agent.runtimeHealth.samples.slice(0, 4).map((server) => (
              <div
                key={server.id}
                className="text-xs text-muted-foreground"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{server.name}</span>
                  <span>{formatAgentRuntimeHealthState(server.health.state)}</span>
                </div>
                <div className="mt-1 font-mono">{server.host}</div>
                <div className="mt-1">
                  {formatAgentRuntimeHealthReason(server.health.reason)}
                  {server.health.lastSeenAgeSeconds !== undefined
                    ? ` · seen ${formatRuntimeSeconds(server.health.lastSeenAgeSeconds)} ago`
                    : ''}
                  {server.health.expiresInSeconds !== undefined
                    ? ` · expires ${formatRuntimeSeconds(server.health.expiresInSeconds)}`
                    : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t pt-3">
        <h4 className="text-xs font-medium text-foreground">Agent fleet</h4>
        {agent.fleet.items.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">暂无 agent server</div>
        ) : (
          <div className="mt-3 space-y-3">
            {agent.fleet.items.slice(0, 6).map((server) => (
              <div
                key={server.id}
                className="border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-foreground">{server.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {server.host}
                    </div>
                  </div>
                  <StatusBadge status={readAgentFleetStatus(server)} />
                </div>
                <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>
                    jobs {server.jobs.ready}/{server.jobs.running}/{server.jobs.blocked}
                  </span>
                  <span>pressure {server.jobs.pressure}</span>
                  <span>
                    {server.runtime
                      ? `runtime ${formatAgentRuntimeState(server.runtime.state)}`
                      : 'runtime -'}
                  </span>
                  <span>
                    health {formatAgentRuntimeHealthState(server.runtimeHealth.state)}
                  </span>
                  <span>
                    {formatAgentRuntimeHealthReason(server.runtimeHealth.reason)}
                  </span>
                  <span>
                    seen {formatRuntimeSeconds(server.runtimeHealth.lastSeenAgeSeconds)}
                  </span>
                  <span>
                    expires {formatRuntimeSeconds(server.runtimeHealth.expiresInSeconds)}
                  </span>
                  <span>
                    {server.readiness.blockingReasons.length
                      ? formatAgentBlockingReasons(server.readiness.blockingReasons)
                      : 'ready'}
                  </span>
                </div>
                {server.jobs.nextQueuedJob ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    next {server.jobs.nextQueuedJob.operationKey} · p{server.jobs.nextQueuedJob.priority}
                  </div>
                ) : null}
                {server.jobs.blockedSample ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    blocked {server.jobs.blockedSample.operationKey} · {server.jobs.blockedSample.reason}
                  </div>
                ) : null}
              </div>
            ))}
            {agent.fleet.truncated ? (
              <div className="text-xs text-muted-foreground">fleet truncated</div>
            ) : null}
          </div>
        )}
      </div>

      {agent.samples.length === 0 ? (
        <div className="mt-4 text-xs text-muted-foreground">暂无 agent capability</div>
      ) : (
        <div className="mt-4 space-y-2 border-t pt-3">
          {agent.samples.slice(0, 5).map((server) => (
            <div
              key={server.id}
              className="text-xs text-muted-foreground"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{server.name}</span>
                <span>{server.status}</span>
              </div>
              <div className="mt-1 font-mono">{server.host}</div>
              <div className="mt-1">
                {server.agentRef.displayName} · {formatAgentSource(server.agentRef.source)}
                {server.agentRef.status ? ` · ${server.agentRef.status}` : ''}
              </div>
              {server.runtime ? (
                <div className="mt-1">
                  runtime {formatAgentRuntimeState(server.runtime.state)}
                  {server.runtime.agentId ? ` · ${shortId(server.runtime.agentId)}` : ''}
                  {server.runtime.version ? ` · ${server.runtime.version}` : ''}
                  {server.runtime.lastSeenAt
                    ? ` · seen ${formatDate(server.runtime.lastSeenAt)}`
                    : ''}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function readAgentFleetStatus(
  server: ServerExecutionSupervisorSnapshot['agent']['fleet']['items'][number],
) {
  if (server.readiness.liveDispatchReady) return 'running';
  if (server.readiness.targetReady) return 'queued';
  return 'blocked';
}

function formatAgentBlockingReasons(reasons: string[]) {
  return reasons.map((reason) => agentBlockingReasonLabels[reason] || reason).join(' · ');
}

function formatAgentRuntimeHealthState(state: string) {
  return agentRuntimeHealthLabels[state] || state;
}

function formatAgentRuntimeHealthReason(reason: string) {
  return agentRuntimeHealthReasonLabels[reason] || reason;
}

function formatAgentLifecycleState(state: string) {
  return agentLifecycleStateLabels[state] || state;
}

function formatAgentLifecycleReason(reason: string) {
  return agentLifecycleReasonLabels[reason] || reason;
}

function formatAgentLifecycleAction(action: string) {
  return agentLifecycleActionLabels[action] || action;
}

function readAgentLifecycleStatus(state: string) {
  if (state === 'ready') return 'running';
  if (state === 'degraded') return 'queued';
  if (state === 'disabled' || state === 'idle') return 'idle';
  return 'blocked';
}

function formatRuntimeSeconds(value?: number) {
  if (value === undefined) return '-';
  return value < 0 ? `-${Math.abs(value)}s` : `${value}s`;
}

function WorkerOwnersCard({ supervisor }: { supervisor: ServerExecutionSupervisorSnapshot }) {
  const inventory = supervisor.workerInventory;
  const coordination = supervisor.queueCoordinationPreflight;
  const orphanGovernance = supervisor.remoteOrphanGovernancePreflight;
  const auditVisibility = supervisor.executionAuditVisibility;

  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Worker inventory</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {inventory.owners.active}/{inventory.owners.total} active owners
          </div>
        </div>
        <StatusBadge status={readWorkerInventoryStatus(inventory.status.state)} />
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label="current"
          value={shortId(inventory.current.workerId)}
        />
        <SupervisorField
          label="state"
          value={formatWorkerInventoryState(inventory.status.state)}
        />
        <SupervisorField
          label="reason"
          value={formatWorkerInventoryReason(inventory.status.reason)}
        />
        <SupervisorField
          label="queue worker"
          value={inventory.current.queueWorkerEnabled ? '开启' : '关闭'}
        />
        <SupervisorField
          label="ready/scheduled"
          value={`${inventory.queue.ready}/${inventory.queue.scheduled}`}
        />
        <SupervisorField
          label="running/stale"
          value={`${inventory.queue.running}/${inventory.queue.staleRunning}`}
        />
        <SupervisorField
          label="owned jobs"
          value={`${inventory.owners.ownedRunningJobs}/${inventory.owners.ownedStaleJobs}`}
        />
        <SupervisorField
          label="unowned"
          value={String(inventory.queue.unownedRunning)}
        />
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-foreground">Queue coordination</h4>
          <StatusBadge status={readQueueCoordinationStatus(coordination.state)} />
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <SupervisorField
            label="preflight"
            value={`${formatQueueCoordinationState(coordination.state)} · ${formatQueueCoordinationReason(coordination.reason)}`}
          />
          <SupervisorField
            label="worker"
            value={`${coordination.gates.worker.enabled ? '开启' : '关闭'} · ${formatQueueCoordinationReason(coordination.gates.worker.reason)}`}
          />
          <SupervisorField
            label="queue"
            value={`${coordination.gates.queue.readyJobs}/${coordination.gates.queue.scheduledJobs}/${coordination.gates.queue.blockedJobs} · ${formatQueueCoordinationReason(coordination.gates.queue.reason)}`}
          />
          <SupervisorField
            label="owners"
            value={`${coordination.gates.owners.activeOwners}/${coordination.gates.owners.totalOwners} · ${formatQueueCoordinationReason(coordination.gates.owners.reason)}`}
          />
          <SupervisorField
            label="recovery"
            value={`${coordination.gates.recovery.staleRunningJobs}/${coordination.gates.recovery.recoveryBatchSize} · ${formatQueueCoordinationReason(coordination.gates.recovery.reason)}`}
          />
          <SupervisorField
            label="pressure"
            value={`${coordination.pressure.backlogJobs}/${coordination.pressure.runningJobs}/${coordination.pressure.blockedJobs}`}
          />
        </div>

        {coordination.blockers.length > 0 ? (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {coordination.blockers.slice(0, 4).map((blocker) => (
              <div
                key={`${blocker.severity}-${blocker.reason}`}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{formatQueueCoordinationReason(blocker.reason)}</span>
                <span>{blocker.severity} · {blocker.count}</span>
              </div>
            ))}
          </div>
        ) : null}

        {coordination.nextSteps.length > 0 ? (
          <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
            {coordination.nextSteps.slice(0, 3).map((step) => (
              <div key={`${step.action}-${step.reason}`}>
                {formatQueueCoordinationAction(step.action)} · {formatQueueCoordinationReason(step.reason)}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-foreground">Remote orphan governance</h4>
          <StatusBadge status={readRemoteOrphanStatus(orphanGovernance.state)} />
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <SupervisorField
            label="preflight"
            value={`${formatRemoteOrphanState(orphanGovernance.state)} · ${formatRemoteOrphanReason(orphanGovernance.reason)}`}
          />
          <SupervisorField
            label="remote session"
            value={`${orphanGovernance.gates.remoteSession.recoverableRemoteSessions}/${orphanGovernance.gates.remoteSession.scannedJobs} · ${formatRemoteOrphanReason(orphanGovernance.gates.remoteSession.reason)}`}
          />
          <SupervisorField
            label="cleanup"
            value={`${orphanGovernance.gates.cleanup.enabled ? '开启' : '关闭'} · ${orphanGovernance.gates.cleanup.cleanupAttempted}/${orphanGovernance.gates.cleanup.cleanupSucceeded}/${orphanGovernance.gates.cleanup.cleanupFailed}`}
          />
          <SupervisorField
            label="owners"
            value={`${orphanGovernance.gates.owners.activeOwners}/${orphanGovernance.gates.owners.staleOwners}/${orphanGovernance.gates.owners.expiredOwners} · ${formatRemoteOrphanReason(orphanGovernance.gates.owners.reason)}`}
          />
          <SupervisorField
            label="recovery"
            value={`${orphanGovernance.gates.recovery.staleRunningJobs}/${orphanGovernance.gates.recovery.scannedJobs}/${orphanGovernance.gates.recovery.unscannedStaleJobs} · ${formatRemoteOrphanReason(orphanGovernance.gates.recovery.reason)}`}
          />
          <SupervisorField
            label="risk"
            value={`${orphanGovernance.risk.missingRemoteSessions}/${orphanGovernance.risk.invalidRemoteSessions}/${orphanGovernance.risk.cleanupFailed}`}
          />
        </div>

        {orphanGovernance.blockers.length > 0 ? (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {orphanGovernance.blockers.slice(0, 4).map((blocker) => (
              <div
                key={`${blocker.severity}-${blocker.reason}`}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{formatRemoteOrphanReason(blocker.reason)}</span>
                <span>{blocker.severity} · {blocker.count}</span>
              </div>
            ))}
          </div>
        ) : null}

        {orphanGovernance.nextSteps.length > 0 ? (
          <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
            {orphanGovernance.nextSteps.slice(0, 3).map((step) => (
              <div key={`${step.action}-${step.reason}`}>
                {formatRemoteOrphanAction(step.action)} · {formatRemoteOrphanReason(step.reason)}
              </div>
            ))}
          </div>
        ) : null}

        {orphanGovernance.samples.length > 0 ? (
          <div className="mt-3 space-y-2 border-t pt-2 text-xs text-muted-foreground">
            {orphanGovernance.samples.slice(0, 2).map((sample) => (
              <div key={sample.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{sample.operationKey} · {sample.server?.name || '未关联服务器'}</span>
                  <span className="font-mono">{shortId(sample.id)}</span>
                </div>
                <div className="mt-1">
                  pid {sample.remoteSession?.pid || '-'} · owner {sample.lockOwner ? shortId(sample.lockOwner) : 'none'} · expires {sample.lockExpiresAt ? formatDate(sample.lockExpiresAt) : '-'}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-foreground">Execution audit visibility</h4>
          <StatusBadge status={readExecutionAuditStatus(auditVisibility)} />
        </div>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <SupervisorField
            label="recent"
            value={`${auditVisibility.totalRecent} events`}
          />
          <SupervisorField
            label="failed/blocked"
            value={`${auditVisibility.failedRecent}/${auditVisibility.blockedRecent}`}
          />
          <SupervisorField
            label="high risk"
            value={String(auditVisibility.highRiskRecent)}
          />
          <SupervisorField
            label="statuses"
            value={auditVisibility.statuses.slice(0, 3).map((item) => `${item.status}:${item.count}`).join(' · ') || '-'}
          />
          <SupervisorField
            label="risks"
            value={auditVisibility.risks.slice(0, 3).map((item) => `${formatAuditRisk(item.risk)}:${item.count}`).join(' · ') || '-'}
          />
          <SupervisorField
            label="top action"
            value={auditVisibility.actions[0]
              ? `${formatExecutionAuditAction(auditVisibility.actions[0].action)} · ${auditVisibility.actions[0].count}`
              : '-'}
          />
        </div>

        {auditVisibility.samples.length > 0 ? (
          <div className="mt-3 space-y-2 border-t pt-2 text-xs text-muted-foreground">
            {auditVisibility.samples.slice(0, 3).map((event) => (
              <div key={event.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{formatExecutionAuditAction(event.action)} · {event.status} · {formatAuditRisk(event.risk)}</span>
                  <span className="font-mono">{event.serverExecutionJobId ? shortId(event.serverExecutionJobId) : shortId(event.id)}</span>
                </div>
                <div className="mt-1">
                  {event.metadata?.operationKey || event.summary || 'execution audit'} · {event.server?.name || '未关联服务器'} · {formatDate(event.occurredAt)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {inventory.owners.samples.length === 0 ? (
        <div className="mt-4 text-muted-foreground">暂无 running job owner</div>
      ) : (
        <div className="mt-4 space-y-3">
          {inventory.owners.samples.map((worker) => (
            <div
              key={worker.lockOwner}
              className="border-b pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="break-all font-mono text-xs">{worker.lockOwner}</div>
                <div className="text-xs text-muted-foreground">
                  {worker.activeJobs} active · {worker.staleJobs} stale
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {worker.sampleJob.operationKey} · {worker.sampleJob.server?.name || '未关联服务器'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatWorkerInventoryState(worker.status)} · seen{' '}
                {formatNullableRuntimeSeconds(worker.lastHeartbeatAgeSeconds)} ago · expires{' '}
                {formatNullableRuntimeSeconds(worker.lockExpiresInSeconds)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function readWorkerInventoryStatus(state: string) {
  if (state === 'blocked') return 'blocked';
  if (state === 'degraded') return 'blocked';
  if (state === 'running') return 'running';
  return 'queued';
}

function formatWorkerInventoryState(state: string) {
  return workerInventoryStateLabels[state] || state;
}

function formatWorkerInventoryReason(reason: string) {
  return workerInventoryReasonLabels[reason] || reason;
}

function readQueueCoordinationStatus(state: string) {
  if (state === 'blocked') return 'blocked';
  if (state === 'degraded') return 'blocked';
  if (state === 'ready') return 'running';
  return 'queued';
}

function formatQueueCoordinationState(state: string) {
  return queueCoordinationStateLabels[state] || state;
}

function formatQueueCoordinationReason(reason: string) {
  return queueCoordinationReasonLabels[reason] || reason;
}

function formatQueueCoordinationAction(action: string) {
  return queueCoordinationActionLabels[action] || action;
}

function readRemoteOrphanStatus(state: string) {
  if (state === 'blocked') return 'blocked';
  if (state === 'degraded') return 'blocked';
  if (state === 'ready') return 'running';
  return 'queued';
}

function formatRemoteOrphanState(state: string) {
  return remoteOrphanStateLabels[state] || state;
}

function formatRemoteOrphanReason(reason: string) {
  return remoteOrphanReasonLabels[reason] || reason;
}

function formatRemoteOrphanAction(action: string) {
  return remoteOrphanActionLabels[action] || action;
}

function readExecutionAuditStatus(
  auditVisibility: ServerExecutionSupervisorSnapshot['executionAuditVisibility'],
) {
  if (auditVisibility.failedRecent > 0) return 'failed';
  if (auditVisibility.blockedRecent > 0 || auditVisibility.highRiskRecent > 0) return 'blocked';
  if (auditVisibility.totalRecent > 0) return 'completed';
  return 'queued';
}

function formatExecutionAuditAction(action: string) {
  return executionAuditActionLabels[action] || action;
}

function formatAuditRisk(risk: string) {
  return auditRiskLabels[risk] || risk;
}

function formatNullableRuntimeSeconds(value?: number | null) {
  return value === null ? '-' : formatRuntimeSeconds(value);
}
