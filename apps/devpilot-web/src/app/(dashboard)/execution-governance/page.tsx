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
  actor?: { id: string; name?: string | null; email: string } | null;
  server?: { id: string; name: string; host: string; status: string } | null;
  retryOf?: { id: string; status: string; operationKey: string; queuedAt: string } | null;
  retryAttempts?: { id: string; status: string; queuedAt: string; finishedAt?: string | null }[];
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
  const [jobStatus, setJobStatus] = useState('all');
  const [leaseStatus, setLeaseStatus] = useState('running');
  const [jobLoading, setJobLoading] = useState(true);
  const [leaseLoading, setLeaseLoading] = useState(true);
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

  const loadData = async () => {
    setError('');
    await Promise.all([loadJobs(), loadLeases()]);
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
                      {job.error && <div className="mt-1 max-w-xs truncate text-xs text-red-600">{job.error}</div>}
                      {job.cancelRequestedAt && <div className="mt-1 text-xs text-yellow-700">已请求取消</div>}
                      {isStaleRunning(job) && <div className="mt-1 text-xs text-red-600">锁租约已过期</div>}
                      {job.recoveryCount > 0 && <div className="mt-1 text-xs text-muted-foreground">恢复 {job.recoveryCount} 次</div>}
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[status] || 'bg-gray-100 text-gray-700'}`}>
      {statusLabels[status] || status}
    </span>
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
