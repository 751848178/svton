'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

interface ServerExecutionLease {
  id: string;
  operationKey: string;
  adapterKey: string;
  transport: string;
  dryRun: boolean;
  status: string;
  activeKey?: string | null;
  metadata?: Record<string, unknown> | null;
  acquiredAt: string;
  releasedAt?: string | null;
  expiresAt: string;
  actor?: { id: string; name?: string | null; email: string } | null;
  server?: { id: string; name: string; host: string; status: string } | null;
}

interface ServerExecutionJob {
  id: string;
  operationKey: string;
  adapterKey: string;
  transport: string;
  dryRun: boolean;
  status: string;
  queueMode: string;
  attempt: number;
  maxAttempts: number;
  error?: string | null;
  queuedAt: string;
  availableAt: string;
  lockedAt?: string | null;
  lockOwner?: string | null;
  lockExpiresAt?: string | null;
  lastHeartbeatAt?: string | null;
  cancelRequestedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  cancelledAt?: string | null;
  recoveredAt?: string | null;
  recoveryReason?: string | null;
  recoveryCount: number;
  metadata?: Record<string, unknown> | null;
  inputSnapshot?: unknown;
  result?: unknown;
  actor?: { id: string; name?: string | null; email: string } | null;
  server?: { id: string; name: string; host: string; status: string } | null;
  retryOf?: { id: string; status: string; operationKey: string; queuedAt: string } | null;
  retryAttempts?: { id: string; status: string; queuedAt: string; finishedAt?: string | null }[];
}

interface ServerExecutionSupervisorSnapshot {
  generatedAt: string;
  worker: {
    workerId: string;
    queueWorkerEnabled: boolean;
    processingQueue: boolean;
    runningCancellations: number;
    queueIntervalSeconds: number;
    queueBatchSize: number;
    retryDelaySeconds: number;
    queueLockTtlSeconds: number;
    queueHeartbeatSeconds: number;
    cancellationPollSeconds: number;
    recoveryBatchSize: number;
    staleRemoteCleanupEnabled: boolean;
  };
  queue: {
    ready: number;
    scheduled: number;
    running: number;
    staleRunning: number;
    blocked: number;
    failed: number;
    cancelled: number;
    nextQueuedJob?: {
      id: string;
      operationKey: string;
      adapterKey: string;
      serverId?: string | null;
      priority: number;
      queuedAt: string;
      availableAt: string;
      server?: { id: string; name: string; host: string; status: string } | null;
    } | null;
  };
  leases: {
    running: number;
    expired: number;
    blocked: number;
  };
  workers: {
    lockOwner: string;
    runningJobs: number;
    staleJobs: number;
    lastHeartbeatAt?: string | null;
    lockExpiresAt?: string | null;
    sampleJob: {
      id: string;
      operationKey: string;
      adapterKey: string;
      serverId?: string | null;
      server?: { id: string; name: string; host: string; status: string } | null;
    };
  }[];
  agent: {
    targetSelectionEnabled: boolean;
    totalServers: number;
    capableServers: number;
    serviceCapabilityServers: number;
    tagCapabilityServers: number;
    onlineCapableServers: number;
    runtime: {
      heartbeatEnabled: boolean;
      tokenConfigured: boolean;
      requiredForTargetSelection: boolean;
      defaultTtlSeconds: number;
      heartbeatServers: number;
      onlineServers: number;
      staleServers: number;
      unknownServers: number;
    };
    statusCounts: { status: string; count: number }[];
    dispatcher: {
      executorEnabled: boolean;
      dispatcherConfigured: boolean;
      dispatcherUrl?: string | null;
      timeoutSeconds: number;
      tokenConfigured: boolean;
    };
    jobs: {
      ready: number;
      scheduled: number;
      running: number;
      staleRunning: number;
      blocked: number;
      failed: number;
      cancelled: number;
      nextQueuedJob?: {
        id: string;
        operationKey: string;
        adapterKey: string;
        serverId?: string | null;
        priority: number;
        queuedAt: string;
        availableAt: string;
        server?: { id: string; name: string; host: string; status: string } | null;
      } | null;
      blockedReasons: {
        scanned: number;
        dispatcherBoundaryJobs: number;
        reasonCounts: { reason: string; count: number; nextExecutorBoundary?: string }[];
        samples: {
          id: string;
          operationKey: string;
          adapterKey: string;
          serverId?: string | null;
          queuedAt: string;
          finishedAt?: string | null;
          server?: { id: string; name: string; host: string; status: string } | null;
          reason: string;
          nextExecutorBoundary?: string;
          dispatcherConfigured?: boolean;
          agentExecutorEnabled?: boolean;
        }[];
      };
    };
    samples: {
      id: string;
      name: string;
      host: string;
      status: string;
      agentRef: ExecutionAgentRef;
      runtime?: {
        state: string;
        status?: string;
        agentId?: string;
        runnerId?: string;
        hostname?: string;
        version?: string;
        lastSeenAt?: string;
        expiresAt?: string;
        heartbeatTtlSeconds?: number;
        capabilities: string[];
      };
    }[];
  };
}

interface RemoteExecutionSession {
  transport: string;
  pid: number;
  observedAt?: string;
  serverHost?: string;
  operationKey?: string;
  adapterKey?: string;
  cleanupStrategy?: string;
}

interface RemoteExecutionCleanup {
  transport: string;
  pid?: number;
  observedAt?: string;
  reason?: string;
  attempted?: boolean;
  succeeded?: boolean;
  error?: string;
}

interface RemoteExecutionSummaryData {
  session?: RemoteExecutionSession;
  cleanup?: RemoteExecutionCleanup;
  staleCleanup?: RemoteExecutionCleanup;
  updatedAt?: string;
}

interface ExecutionAgentRef {
  source: string;
  referenceId: string;
  displayName: string;
  capabilityKey: string;
  status?: string;
  redacted?: boolean;
}

interface ExecutionTargetSummaryData {
  transport: string;
  agentRef?: ExecutionAgentRef;
}

interface AgentDispatchSummaryData {
  mode: string;
  executed?: boolean;
  agentExecutorEnabled?: boolean;
  dispatcherConfigured?: boolean;
  dispatcher?: string;
  serverExecutionJobId?: string;
  serverExecutionLeaseId?: string;
  retryAttempt?: number;
  maxAttempts?: number;
  dispatchId?: string;
  idempotencyKey?: string;
  responseStatus?: string;
  agentRunId?: string;
  nextExecutorBoundary?: string;
  responseError?: string;
}

const statusLabels: Record<string, string> = {
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  blocked: '已阻塞',
  cancelled: '已取消',
  expired: '已过期',
};

const statusClasses: Record<string, string> = {
  queued: 'bg-indigo-100 text-indigo-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  blocked: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700',
};

export default function ExecutionGovernancePage() {
  const [jobs, setJobs] = useState<ServerExecutionJob[]>([]);
  const [leases, setLeases] = useState<ServerExecutionLease[]>([]);
  const [supervisor, setSupervisor] = useState<ServerExecutionSupervisorSnapshot | null>(null);
  const [jobStatus, setJobStatus] = useState('all');
  const [leaseStatus, setLeaseStatus] = useState('running');
  const [jobLoading, setJobLoading] = useState(true);
  const [leaseLoading, setLeaseLoading] = useState(true);
  const [supervisorLoading, setSupervisorLoading] = useState(true);
  const [supervisorError, setSupervisorError] = useState('');
  const [actingJobId, setActingJobId] = useState('');
  const [processingQueue, setProcessingQueue] = useState(false);
  const [recoveringStale, setRecoveringStale] = useState(false);
  const [actingLease, setActingLease] = useState(false);
  const [error, setError] = useState('');

  const loadJobs = async () => {
    setJobLoading(true);
    try {
      const params = jobStatus === 'all' ? undefined : { status: jobStatus };
      const data = await api.get<ServerExecutionJob[]>('/server-execution-jobs', params ? { params } : undefined);
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载执行任务失败');
    } finally {
      setJobLoading(false);
    }
  };

  const loadLeases = async () => {
    setLeaseLoading(true);
    try {
      const params = leaseStatus === 'all' ? undefined : { status: leaseStatus };
      const data = await api.get<ServerExecutionLease[]>('/server-execution-leases', params ? { params } : undefined);
      setLeases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载执行占用失败');
    } finally {
      setLeaseLoading(false);
    }
  };

  const loadSupervisor = async () => {
    setSupervisorLoading(true);
    setSupervisorError('');
    try {
      const data = await api.get<ServerExecutionSupervisorSnapshot>('/server-execution-jobs/supervisor');
      setSupervisor(data);
    } catch (err) {
      setSupervisor(null);
      setSupervisorError(err instanceof Error ? err.message : '加载 Supervisor 状态失败');
    } finally {
      setSupervisorLoading(false);
    }
  };

  const loadData = async () => {
    setError('');
    await Promise.all([loadJobs(), loadLeases(), loadSupervisor()]);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobStatus, leaseStatus]);

  const jobStats = useMemo(() => ({
    total: jobs.length,
    queued: jobs.filter((job) => job.status === 'queued').length,
    running: jobs.filter((job) => job.status === 'running').length,
    stale: jobs.filter((job) => isStaleRunning(job)).length,
    blocked: jobs.filter((job) => job.status === 'blocked').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
    cancelled: jobs.filter((job) => job.status === 'cancelled').length,
  }), [jobs]);

  const leaseStats = useMemo(() => ({
    total: leases.length,
    running: leases.filter((lease) => lease.status === 'running').length,
    blocked: leases.filter((lease) => lease.status === 'blocked').length,
    expired: leases.filter((lease) => lease.status === 'expired').length,
    failed: leases.filter((lease) => lease.status === 'failed').length,
  }), [leases]);

  const expireStale = async () => {
    setActingLease(true);
    setError('');
    try {
      await api.post('/server-execution-leases/expire-stale', {});
      await loadLeases();
    } catch (err) {
      setError(err instanceof Error ? err.message : '释放过期执行占用失败');
    } finally {
      setActingLease(false);
    }
  };

  const cancelJob = async (job: ServerExecutionJob) => {
    if (!window.confirm(`请求取消执行任务 ${job.operationKey}？`)) return;

    setActingJobId(job.id);
    setError('');
    try {
      await api.post(`/server-execution-jobs/${job.id}/cancel`, {});
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消执行任务失败');
    } finally {
      setActingJobId('');
    }
  };

  const retryJob = async (job: ServerExecutionJob) => {
    if (!window.confirm(`把执行任务 ${job.operationKey} 加入重试队列？`)) return;

    setActingJobId(job.id);
    setError('');
    try {
      await api.post(`/server-execution-jobs/${job.id}/retry`, {
        queue: true,
        maxAttempts: Math.max(job.maxAttempts, job.attempt + 1),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试执行任务失败');
    } finally {
      setActingJobId('');
    }
  };

  const processNextQueuedJob = async () => {
    setProcessingQueue(true);
    setError('');
    try {
      await api.post('/server-execution-jobs/process-next', {});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理队列任务失败');
    } finally {
      setProcessingQueue(false);
    }
  };

  const recoverStaleJobs = async () => {
    setRecoveringStale(true);
    setError('');
    try {
      await api.post('/server-execution-jobs/recover-stale', {});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复僵尸任务失败');
    } finally {
      setRecoveringStale(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">执行治理</h1>
          <p className="mt-1 text-muted-foreground">
            查看 Server executor 执行任务、live 占用、阻塞和释放记录
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={processNextQueuedJob}
            disabled={processingQueue}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {processingQueue ? '处理中...' : '处理队列'}
          </button>
          <button
            onClick={recoverStaleJobs}
            disabled={recoveringStale}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {recoveringStale ? '恢复中...' : '恢复僵尸'}
          </button>
          <button
            onClick={expireStale}
            disabled={actingLease}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {actingLease ? '处理中...' : '释放过期'}
          </button>
          <button
            onClick={loadData}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Supervisor</h2>
          <p className="text-sm text-muted-foreground">Server executor queue worker</p>
        </div>

        {supervisorLoading ? (
          <div className="py-8 text-center text-muted-foreground">加载中...</div>
        ) : supervisor ? (
          <>
            <div className="grid gap-4 md:grid-cols-10">
              <Metric label="Ready" value={supervisor.queue.ready} />
              <Metric label="Scheduled" value={supervisor.queue.scheduled} />
              <Metric label="Running" value={supervisor.queue.running} />
              <Metric label="Stale" value={supervisor.queue.staleRunning} />
              <Metric label="Active lease" value={supervisor.leases.running} />
              <Metric label="Workers" value={supervisor.workers.length} />
              <Metric label="Agent targets" value={supervisor.agent.capableServers} />
              <Metric label="Agent runtime" value={supervisor.agent.runtime.onlineServers} />
              <Metric label="Agent stale" value={supervisor.agent.runtime.staleServers} />
              <Metric label="Agent ready" value={supervisor.agent.jobs.ready} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">本进程</h3>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{supervisor.worker.workerId}</div>
                  </div>
                  <StatusBadge status={supervisor.worker.queueWorkerEnabled ? 'running' : 'blocked'} />
                </div>
                <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <SupervisorField label="处理队列" value={supervisor.worker.processingQueue ? '是' : '否'} />
                  <SupervisorField label="取消令牌" value={String(supervisor.worker.runningCancellations)} />
                  <SupervisorField label="批量大小" value={String(supervisor.worker.queueBatchSize)} />
                  <SupervisorField label="轮询间隔" value={`${supervisor.worker.queueIntervalSeconds}s`} />
                  <SupervisorField label="锁 TTL" value={`${supervisor.worker.queueLockTtlSeconds}s`} />
                  <SupervisorField label="心跳间隔" value={`${supervisor.worker.queueHeartbeatSeconds}s`} />
                  <SupervisorField label="取消轮询" value={`${supervisor.worker.cancellationPollSeconds}s`} />
                  <SupervisorField label="远端追偿" value={supervisor.worker.staleRemoteCleanupEnabled ? '开启' : '关闭'} />
                </div>
                {supervisor.queue.nextQueuedJob && (
                  <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">下一任务</span>
                    <span> · {supervisor.queue.nextQueuedJob.operationKey}</span>
                    <span> · {supervisor.queue.nextQueuedJob.adapterKey}</span>
                    <span> · {supervisor.queue.nextQueuedJob.server?.name || '未关联服务器'}</span>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">Agent readiness</h3>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {supervisor.agent.capableServers}/{supervisor.agent.totalServers} servers
                    </div>
                  </div>
                  <StatusBadge status={supervisor.agent.targetSelectionEnabled ? 'running' : 'blocked'} />
                </div>
                <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <SupervisorField label="executor" value={supervisor.agent.dispatcher.executorEnabled ? '开启' : '关闭'} />
                  <SupervisorField label="dispatcher" value={supervisor.agent.dispatcher.dispatcherConfigured ? '已配置' : '未配置'} />
                  <SupervisorField label="timeout" value={`${supervisor.agent.dispatcher.timeoutSeconds}s`} />
                  <SupervisorField label="token" value={supervisor.agent.dispatcher.tokenConfigured ? '已配置' : '未配置'} />
                  <SupervisorField label="heartbeat" value={supervisor.agent.runtime.heartbeatEnabled ? '开启' : '关闭'} />
                  <SupervisorField label="hb token" value={supervisor.agent.runtime.tokenConfigured ? '已配置' : '未配置'} />
                  <SupervisorField label="hb required" value={supervisor.agent.runtime.requiredForTargetSelection ? '开启' : '关闭'} />
                  <SupervisorField label="services 来源" value={String(supervisor.agent.serviceCapabilityServers)} />
                  <SupervisorField label="tags 来源" value={String(supervisor.agent.tagCapabilityServers)} />
                  <SupervisorField label="在线可用" value={String(supervisor.agent.onlineCapableServers)} />
                  <SupervisorField
                    label="runtime"
                    value={`${supervisor.agent.runtime.onlineServers}/${supervisor.agent.runtime.staleServers}/${supervisor.agent.runtime.unknownServers}`}
                  />
                  <SupervisorField label="hb ttl" value={`${supervisor.agent.runtime.defaultTtlSeconds}s`} />
                  <SupervisorField
                    label="状态分布"
                    value={supervisor.agent.statusCounts.length
                      ? supervisor.agent.statusCounts.map((item) => `${item.status}:${item.count}`).join(' · ')
                      : '-'}
                  />
                </div>
                {supervisor.agent.dispatcher.dispatcherUrl && (
                  <div className="mt-3 break-all font-mono text-xs text-muted-foreground">
                    {supervisor.agent.dispatcher.dispatcherUrl}
                  </div>
                )}
                <div className="mt-4 border-t pt-3">
                  <h4 className="text-xs font-medium text-foreground">Agent jobs</h4>
                  <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <SupervisorField
                      label="ready/scheduled"
                      value={`${supervisor.agent.jobs.ready}/${supervisor.agent.jobs.scheduled}`}
                    />
                    <SupervisorField
                      label="running/stale"
                      value={`${supervisor.agent.jobs.running}/${supervisor.agent.jobs.staleRunning}`}
                    />
                    <SupervisorField
                      label="blocked/failed"
                      value={`${supervisor.agent.jobs.blocked}/${supervisor.agent.jobs.failed}`}
                    />
                    <SupervisorField label="cancelled" value={String(supervisor.agent.jobs.cancelled)} />
                  </div>
                  {supervisor.agent.jobs.nextQueuedJob && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">下一 agent 任务</span>
                      <span> · {supervisor.agent.jobs.nextQueuedJob.operationKey}</span>
                      <span> · {supervisor.agent.jobs.nextQueuedJob.adapterKey}</span>
                      <span> · {supervisor.agent.jobs.nextQueuedJob.server?.name || '未关联服务器'}</span>
                    </div>
                  )}
                  {supervisor.agent.jobs.blockedReasons.scanned > 0 && (
                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">Blocked reasons</span>
                        <span> · scanned {supervisor.agent.jobs.blockedReasons.scanned}</span>
                        <span> · dispatcher {supervisor.agent.jobs.blockedReasons.dispatcherBoundaryJobs}</span>
                      </div>
                      <div className="space-y-1">
                        {supervisor.agent.jobs.blockedReasons.reasonCounts.slice(0, 3).map((item) => (
                          <div key={`${item.reason}:${item.nextExecutorBoundary || ''}`}>
                            <span>{item.count}x</span>
                            <span> · {item.reason}</span>
                            {item.nextExecutorBoundary && <span> · {item.nextExecutorBoundary}</span>}
                          </div>
                        ))}
                      </div>
                      {supervisor.agent.jobs.blockedReasons.samples[0] && (
                        <div className="border-t pt-2">
                          <span className="font-medium text-foreground">最近阻塞</span>
                          <span> · {supervisor.agent.jobs.blockedReasons.samples[0].operationKey}</span>
                          <span> · {supervisor.agent.jobs.blockedReasons.samples[0].server?.name || '未关联服务器'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {supervisor.agent.samples.length === 0 ? (
                  <div className="mt-4 text-xs text-muted-foreground">暂无 agent capability</div>
                ) : (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    {supervisor.agent.samples.slice(0, 5).map((server) => (
                      <div key={server.id} className="text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{server.name}</span>
                          <span>{server.status}</span>
                        </div>
                        <div className="mt-1 font-mono">{server.host}</div>
                        <div className="mt-1">
                          {server.agentRef.displayName}
                          <span> · {formatAgentSource(server.agentRef.source)}</span>
                          {server.agentRef.status && <span> · {server.agentRef.status}</span>}
                        </div>
                        {server.runtime && (
                          <div className="mt-1">
                            runtime {formatAgentRuntimeState(server.runtime.state)}
                            {server.runtime.agentId && <span> · {shortId(server.runtime.agentId)}</span>}
                            {server.runtime.version && <span> · {server.runtime.version}</span>}
                            {server.runtime.lastSeenAt && <span> · seen {formatDate(server.runtime.lastSeenAt)}</span>}
                            {server.runtime.expiresAt && <span> · exp {formatDate(server.runtime.expiresAt)}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 text-sm">
                <h3 className="font-medium">Worker owners</h3>
                {supervisor.workers.length === 0 ? (
                  <div className="mt-4 text-muted-foreground">暂无 running job owner</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {supervisor.workers.map((worker) => (
                      <div key={worker.lockOwner} className="border-b pb-3 last:border-b-0 last:pb-0">
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
                          心跳：{formatDate(worker.lastHeartbeatAt)} · 锁到：{formatDate(worker.lockExpiresAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
            {supervisorError || 'Supervisor 状态不可用'}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">执行任务</h2>
            <p className="text-sm text-muted-foreground">Server executor job history</p>
          </div>
          <label className="block w-44 text-sm">
            <span className="mb-1 block font-medium">状态</span>
            <select
              value={jobStatus}
              onChange={(event) => setJobStatus(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="all">全部</option>
              <option value="queued">排队中</option>
              <option value="running">运行中</option>
              <option value="blocked">已阻塞</option>
              <option value="failed">失败</option>
              <option value="cancelled">已取消</option>
              <option value="completed">已完成</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-6">
          <Metric label="任务" value={jobStats.total} />
          <Metric label="排队中" value={jobStats.queued} />
          <Metric label="运行中" value={jobStats.running} />
          <Metric label="锁过期" value={jobStats.stale} />
          <Metric label="已阻塞" value={jobStats.blocked} />
          <Metric label="失败" value={jobStats.failed} />
        </div>

        {jobLoading ? (
          <div className="py-10 text-center text-muted-foreground">加载中...</div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border py-10 text-center">
            <h3 className="text-base font-medium">暂无执行任务</h3>
            <p className="mt-2 text-sm text-muted-foreground">Server executor 执行后会在这里出现</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">服务器</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                  <th className="px-4 py-3 font-medium">尝试</th>
                  <th className="px-4 py-3 font-medium">申请人</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{job.server?.name || '未关联服务器'}</div>
                      <div className="font-mono text-xs text-muted-foreground">{job.server?.host || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{job.operationKey}</div>
                      <div className="font-mono text-xs text-muted-foreground">{job.adapterKey} · {job.queueMode}</div>
                      <ExecutionTargetSummary job={job} />
                      <AgentDispatchSummary result={job.result} />
                      {job.error && <div className="mt-1 max-w-xs truncate text-xs text-red-600">{job.error}</div>}
                      {job.cancelRequestedAt && <div className="mt-1 text-xs text-yellow-700">已请求取消</div>}
                      {isStaleRunning(job) && <div className="mt-1 text-xs text-red-600">锁租约已过期</div>}
                      {job.recoveryCount > 0 && <div className="mt-1 text-xs text-muted-foreground">恢复 {job.recoveryCount} 次</div>}
                      <RemoteExecutionSummary metadata={job.metadata} />
                    </td>
                    <td className="px-4 py-3">
                      <div>{job.attempt}/{job.maxAttempts}</div>
                      <div className="text-xs text-muted-foreground">{job.retryOf ? `retry: ${shortId(job.retryOf.id)}` : 'original'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {job.actor?.name || job.actor?.email || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>入队：{formatDate(job.queuedAt)}</div>
                      <div>可用：{formatDate(job.availableAt)}</div>
                      <div>心跳：{formatDate(job.lastHeartbeatAt)}</div>
                      <div>锁到：{formatDate(job.lockExpiresAt)}</div>
                      <div>开始：{formatDate(job.startedAt)}</div>
                      <div>结束：{formatDate(job.finishedAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canRetry(job) && (
                          <button
                            onClick={() => retryJob(job)}
                            disabled={actingJobId === job.id}
                            className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                          >
                            重试
                          </button>
                        )}
                        {canCancel(job) && (
                          <button
                            onClick={() => cancelJob(job)}
                            disabled={actingJobId === job.id}
                            className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                          >
                            取消
                          </button>
                        )}
                        {!canRetry(job) && !canCancel(job) && <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Live 占用</h2>
            <p className="text-sm text-muted-foreground">ServerExecutionLease</p>
          </div>
          <label className="block w-44 text-sm">
            <span className="mb-1 block font-medium">状态</span>
            <select
              value={leaseStatus}
              onChange={(event) => setLeaseStatus(event.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="running">运行中</option>
              <option value="blocked">已阻塞</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="expired">已过期</option>
              <option value="all">全部</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Metric label="当前列表" value={leaseStats.total} />
          <Metric label="运行中" value={leaseStats.running} />
          <Metric label="已阻塞" value={leaseStats.blocked} />
          <Metric label="已过期" value={leaseStats.expired} />
          <Metric label="失败" value={leaseStats.failed} />
        </div>

        {leaseLoading ? (
          <div className="py-10 text-center text-muted-foreground">加载中...</div>
        ) : leases.length === 0 ? (
          <div className="rounded-lg border py-10 text-center">
            <h3 className="text-base font-medium">暂无执行占用记录</h3>
            <p className="mt-2 text-sm text-muted-foreground">Server executor live 执行或阻塞后会在这里出现</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">服务器</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                  <th className="px-4 py-3 font-medium">执行器</th>
                  <th className="px-4 py-3 font-medium">申请人</th>
                  <th className="px-4 py-3 font-medium">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leases.map((lease) => (
                  <tr key={lease.id}>
                    <td className="px-4 py-3">
                      <StatusBadge status={lease.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{lease.server?.name || '未关联服务器'}</div>
                      <div className="font-mono text-xs text-muted-foreground">{lease.server?.host || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{lease.operationKey}</div>
                      <div className="font-mono text-xs text-muted-foreground">{readBlockedBy(lease.metadata)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{lease.adapterKey}</div>
                      <div className="text-xs text-muted-foreground">{lease.transport}</div>
                    </td>
                    <td className="px-4 py-3">
                      {lease.actor?.name || lease.actor?.email || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>占用：{formatDate(lease.acquiredAt)}</div>
                      <div>释放：{formatDate(lease.releasedAt)}</div>
                      <div>过期：{formatDate(lease.expiresAt)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function SupervisorField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[status] || 'bg-gray-100 text-gray-700'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

function ExecutionTargetSummary({ job }: { job: ServerExecutionJob }) {
  const target = readExecutionTarget(job);
  const isAgentTarget = target.transport === 'server_agent';
  const transportClass = isAgentTarget
    ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
    : 'bg-muted text-muted-foreground ring-border';

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">执行路径</span>
      <span className={`rounded-full px-2 py-0.5 font-mono ring-1 ${transportClass}`}>
        {target.transport}
      </span>
      {target.agentRef ? (
        <span className="min-w-0 text-muted-foreground">
          agent: <span className="text-foreground">{target.agentRef.displayName}</span>
          {target.agentRef.displayName !== target.agentRef.capabilityKey && (
            <span> · <span className="font-mono text-foreground">{target.agentRef.capabilityKey}</span></span>
          )}
          <span> · {formatAgentSource(target.agentRef.source)}</span>
          {target.agentRef.status && <span> · {target.agentRef.status}</span>}
        </span>
      ) : isAgentTarget ? (
        <span className="text-yellow-700">agentRef 缺失</span>
      ) : null}
    </div>
  );
}

function AgentDispatchSummary({ result }: { result?: unknown }) {
  const dispatch = readAgentDispatch(result);
  if (!dispatch) return null;

  const statusClass = dispatch.mode === 'agent_dispatch'
    ? dispatch.executed
      ? 'text-green-700'
      : 'text-yellow-700'
    : dispatch.mode === 'agent_dispatch_failed'
      ? 'text-red-600'
      : 'text-yellow-700';

  return (
    <div className="mt-2 space-y-1 border-l-2 border-violet-200 pl-2 text-xs">
      <div className={statusClass}>
        <span className="font-medium text-foreground">Agent dispatch</span>
        <span> · {formatAgentDispatchMode(dispatch.mode)}</span>
        {dispatch.responseStatus && <span> · {dispatch.responseStatus}</span>}
        {dispatch.agentRunId && <span> · run {shortId(dispatch.agentRunId)}</span>}
      </div>
      <div className="text-muted-foreground">
        <span>executor {formatEnabled(dispatch.agentExecutorEnabled)}</span>
        <span> · dispatcher {formatConfigured(dispatch.dispatcherConfigured)}</span>
        {dispatch.dispatcher && <span> · <span className="font-mono text-foreground">{dispatch.dispatcher}</span></span>}
      </div>
      {(dispatch.dispatchId || dispatch.serverExecutionJobId || dispatch.retryAttempt) && (
        <div className="text-muted-foreground">
          {dispatch.dispatchId && (
            <span>dispatch <span className="font-mono text-foreground">{dispatch.dispatchId}</span></span>
          )}
          {dispatch.serverExecutionJobId && (
            <span> · job <span className="font-mono text-foreground">{shortId(dispatch.serverExecutionJobId)}</span></span>
          )}
          {dispatch.serverExecutionLeaseId && (
            <span> · lease <span className="font-mono text-foreground">{shortId(dispatch.serverExecutionLeaseId)}</span></span>
          )}
          {dispatch.retryAttempt && (
            <span> · attempt {dispatch.retryAttempt}{dispatch.maxAttempts ? `/${dispatch.maxAttempts}` : ''}</span>
          )}
        </div>
      )}
      {dispatch.idempotencyKey && (
        <div className="max-w-xs truncate text-muted-foreground">
          idempotency: <span className="font-mono text-foreground">{dispatch.idempotencyKey}</span>
        </div>
      )}
      {dispatch.nextExecutorBoundary && (
        <div className="text-yellow-700">边界：{dispatch.nextExecutorBoundary}</div>
      )}
      {dispatch.responseError && (
        <div className="max-w-xs truncate text-red-600">响应错误：{dispatch.responseError}</div>
      )}
    </div>
  );
}

function RemoteExecutionSummary({ metadata }: { metadata?: Record<string, unknown> | null }) {
  const remoteExecution = readRemoteExecution(metadata);
  if (!remoteExecution) return null;

  const session = remoteExecution.session;
  const cleanup = remoteExecution.cleanup;
  const staleCleanup = remoteExecution.staleCleanup;

  return (
    <div className="mt-2 space-y-1 border-l-2 border-indigo-200 pl-2 text-xs">
      {session && (
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">远端 PID {session.pid}</span>
          <span> · {session.transport}</span>
          {session.serverHost && <span> · {session.serverHost}</span>}
          {session.cleanupStrategy && <span> · {session.cleanupStrategy}</span>}
        </div>
      )}
      {cleanup && <RemoteCleanupLine label="执行期清理" cleanup={cleanup} />}
      {staleCleanup && <RemoteCleanupLine label="追偿清理" cleanup={staleCleanup} />}
      {remoteExecution.updatedAt && (
        <div className="text-muted-foreground">更新：{formatDate(remoteExecution.updatedAt)}</div>
      )}
    </div>
  );
}

function RemoteCleanupLine({ label, cleanup }: { label: string; cleanup: RemoteExecutionCleanup }) {
  const succeeded = cleanup.succeeded === true;
  const failed = cleanup.succeeded === false;
  const statusClass = succeeded
    ? 'text-green-700'
    : failed
      ? 'text-red-600'
      : 'text-yellow-700';
  const statusText = cleanup.attempted === false
    ? '未尝试'
    : succeeded
      ? '成功'
      : failed
        ? '失败'
        : '已尝试';

  return (
    <div className={statusClass}>
      {label}：{statusText}
      {cleanup.pid && <span> · PID {cleanup.pid}</span>}
      {cleanup.reason && <span> · {formatCleanupReason(cleanup.reason)}</span>}
      {cleanup.error && <span className="text-red-600"> · {cleanup.error}</span>}
    </div>
  );
}

function canRetry(job: ServerExecutionJob) {
  return ['failed', 'blocked', 'cancelled'].includes(job.status);
}

function canCancel(job: ServerExecutionJob) {
  return ['queued', 'blocked', 'running'].includes(job.status) && !job.cancelRequestedAt;
}

function isStaleRunning(job: ServerExecutionJob) {
  if (job.status !== 'running' || !job.lockExpiresAt) return false;
  return new Date(job.lockExpiresAt).getTime() <= Date.now();
}

function readBlockedBy(metadata?: Record<string, unknown> | null) {
  const operation = metadata?.blockedByOperationKey;
  return typeof operation === 'string' && operation ? `阻塞来源：${operation}` : '-';
}

function readExecutionTarget(job: ServerExecutionJob): ExecutionTargetSummaryData {
  const snapshot = asRecord(job.inputSnapshot);
  const target = asRecord(snapshot?.target);
  const transport = readString(target?.transport) || readString(job.transport) || '-';
  const agentRef = readAgentRef(target?.agentRef);

  return {
    transport,
    ...(agentRef ? { agentRef } : {}),
  };
}

function readAgentRef(value: unknown): ExecutionAgentRef | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const source = readString(record.source);
  const referenceId = readString(record.referenceId);
  const displayName = readString(record.displayName);
  const capabilityKey = readString(record.capabilityKey);
  if (!source || !referenceId || !displayName || !capabilityKey) return undefined;

  const status = readString(record.status);
  const redacted = readBoolean(record.redacted);

  return {
    source,
    referenceId,
    displayName,
    capabilityKey,
    ...(status ? { status } : {}),
    ...(redacted !== undefined ? { redacted } : {}),
  };
}

function readAgentDispatch(result?: unknown): AgentDispatchSummaryData | null {
  const record = asRecord(result);
  const mode = readString(record?.mode);
  if (!record || !mode) return null;

  const transport = readString(record.transport);
  const nextExecutorBoundary = readString(record.nextExecutorBoundary);
  const isAgentDispatch = (
    mode === 'agent_dispatch' ||
    mode === 'agent_dispatch_failed' ||
    (transport === 'server_agent' && mode === 'cancelled') ||
    nextExecutorBoundary === 'server_agent_dispatcher'
  );
  if (!isAgentDispatch) return null;

  const dispatcherResponse = asRecord(record.dispatcherResponse);
  const responseStatus = readString(dispatcherResponse?.status);
  const agentRunId = readString(dispatcherResponse?.agentRunId)
    || readString(dispatcherResponse?.runId)
    || readString(dispatcherResponse?.executionId)
    || readString(dispatcherResponse?.id);
  const responseError = readString(dispatcherResponse?.error);
  const executed = readBoolean(record.executed);
  const agentExecutorEnabled = readBoolean(record.agentExecutorEnabled);
  const dispatcherConfigured = readBoolean(record.dispatcherConfigured);
  const dispatcher = readString(record.dispatcher);
  const envelope = asRecord(record.dispatchEnvelope);
  const correlation = asRecord(record.correlation) || asRecord(envelope?.correlation);
  const serverExecutionJobId = readString(correlation?.serverExecutionJobId);
  const serverExecutionLeaseId = readString(correlation?.serverExecutionLeaseId);
  const retryAttempt = readNumber(correlation?.retryAttempt);
  const maxAttempts = readNumber(correlation?.maxAttempts);
  const dispatchId = readString(correlation?.dispatchId);
  const idempotencyKey = readString(correlation?.idempotencyKey);

  return {
    mode,
    ...(executed !== undefined ? { executed } : {}),
    ...(agentExecutorEnabled !== undefined ? { agentExecutorEnabled } : {}),
    ...(dispatcherConfigured !== undefined ? { dispatcherConfigured } : {}),
    ...(dispatcher ? { dispatcher } : {}),
    ...(serverExecutionJobId ? { serverExecutionJobId } : {}),
    ...(serverExecutionLeaseId ? { serverExecutionLeaseId } : {}),
    ...(retryAttempt ? { retryAttempt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(dispatchId ? { dispatchId } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(responseStatus ? { responseStatus } : {}),
    ...(agentRunId ? { agentRunId } : {}),
    ...(nextExecutorBoundary ? { nextExecutorBoundary } : {}),
    ...(responseError ? { responseError } : {}),
  };
}

function readRemoteExecution(metadata?: Record<string, unknown> | null): RemoteExecutionSummaryData | null {
  const remoteExecution = asRecord(metadata?.remoteExecution);
  if (!remoteExecution) return null;

  const summary: RemoteExecutionSummaryData = {
    session: readRemoteExecutionSession(remoteExecution.session),
    cleanup: readRemoteExecutionCleanup(remoteExecution.cleanup),
    staleCleanup: readRemoteExecutionCleanup(remoteExecution.staleCleanup),
    updatedAt: readString(remoteExecution.updatedAt),
  };

  return summary.session || summary.cleanup || summary.staleCleanup || summary.updatedAt
    ? summary
    : null;
}

function readRemoteExecutionSession(value: unknown): RemoteExecutionSession | undefined {
  const record = asRecord(value);
  const pid = readNumber(record?.pid);
  const transport = readString(record?.transport);
  if (!record || !pid || !transport) return undefined;

  const observedAt = readString(record.observedAt);
  const serverHost = readString(record.serverHost);
  const operationKey = readString(record.operationKey);
  const adapterKey = readString(record.adapterKey);
  const cleanupStrategy = readString(record.cleanupStrategy);

  return {
    transport,
    pid,
    ...(observedAt ? { observedAt } : {}),
    ...(serverHost ? { serverHost } : {}),
    ...(operationKey ? { operationKey } : {}),
    ...(adapterKey ? { adapterKey } : {}),
    ...(cleanupStrategy ? { cleanupStrategy } : {}),
  };
}

function readRemoteExecutionCleanup(value: unknown): RemoteExecutionCleanup | undefined {
  const record = asRecord(value);
  const transport = readString(record?.transport);
  if (!record || !transport) return undefined;

  const pid = readNumber(record.pid);
  const observedAt = readString(record.observedAt);
  const reason = readString(record.reason);
  const attempted = readBoolean(record.attempted);
  const succeeded = readBoolean(record.succeeded);
  const error = readString(record.error);

  return {
    transport,
    ...(pid ? { pid } : {}),
    ...(observedAt ? { observedAt } : {}),
    ...(reason ? { reason } : {}),
    ...(attempted !== undefined ? { attempted } : {}),
    ...(succeeded !== undefined ? { succeeded } : {}),
    ...(error ? { error } : {}),
  };
}

function formatCleanupReason(reason: string) {
  const labels: Record<string, string> = {
    cancel: '取消',
    timeout: '超时',
    stale_recovery: 'stale recovery',
  };
  return labels[reason] || reason;
}

function formatAgentSource(source: string) {
  const labels: Record<string, string> = {
    server_services: 'services',
    server_tags: 'tags',
  };
  return labels[source] || source;
}

function formatAgentDispatchMode(mode: string) {
  const labels: Record<string, string> = {
    agent_dispatch: '已投递',
    agent_dispatch_failed: '投递失败',
    blocked_live_execution: 'live 阻塞',
    dry_run: 'dry-run 计划',
    cancelled: '已取消',
  };
  return labels[mode] || mode;
}

function formatAgentRuntimeState(state: string) {
  const labels: Record<string, string> = {
    online: 'online',
    stale: 'stale',
    unknown: 'unknown',
  };
  return labels[state] || state;
}

function formatEnabled(value?: boolean) {
  if (value === undefined) return '-';
  return value ? '开启' : '关闭';
}

function formatConfigured(value?: boolean) {
  if (value === undefined) return '-';
  return value ? '已配置' : '未配置';
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function shortId(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
