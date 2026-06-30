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

export function SupervisorPanel({ supervisor, loading, error }: SupervisorPanelProps) {
  if (loading) return <LoadingState text="加载中..." />;
  if (!supervisor) {
    return <EmptyState text={error || 'Supervisor 状态不可用'} />;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-10">
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
      </div>
      {agent.dispatcher.dispatcherUrl ? (
        <div className="mt-3 break-all font-mono text-xs text-muted-foreground">
          {agent.dispatcher.dispatcherUrl}
        </div>
      ) : null}

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

function formatRuntimeSeconds(value?: number) {
  if (value === undefined) return '-';
  return value < 0 ? `-${Math.abs(value)}s` : `${value}s`;
}

function WorkerOwnersCard({ supervisor }: { supervisor: ServerExecutionSupervisorSnapshot }) {
  return (
    <div className="rounded-lg border p-4 text-sm">
      <h3 className="font-medium">Worker owners</h3>
      {supervisor.workers.length === 0 ? (
        <div className="mt-4 text-muted-foreground">暂无 running job owner</div>
      ) : (
        <div className="mt-4 space-y-3">
          {supervisor.workers.map((worker) => (
            <div
              key={worker.lockOwner}
              className="border-b pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-xs">{worker.lockOwner}</div>
                <div className="text-xs text-muted-foreground">
                  {worker.runningJobs} running · {worker.staleJobs} stale
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {worker.sampleJob.operationKey} · {worker.sampleJob.server?.name || '未关联服务器'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                心跳：{formatDate(worker.lastHeartbeatAt)} · 锁到：
                {formatDate(worker.lockExpiresAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
