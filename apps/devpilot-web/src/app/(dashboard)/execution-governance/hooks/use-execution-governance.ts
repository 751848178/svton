import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import {
  buildExecutionJobParams,
  buildExecutionJobScopeKey,
  buildExecutionLeaseParams,
} from '../execution-governance-scope.utils';
import type { ExecutionGovernanceScope, ServerExecutionJob, ServerExecutionLease } from '../types';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';
import { isStaleRunning } from '../utils';

type JobStatKey = 'total' | 'queued' | 'running' | 'stale' | 'blocked' | 'failed' | 'cancelled' | 'completed';
type LeaseStatKey = 'total' | 'running' | 'blocked' | 'expired' | 'failed';

export type JobStats = Record<JobStatKey, number>;
export type LeaseStats = Record<LeaseStatKey, number>;

/** 待确认的任务操作（cancel/retry），由组件层渲染 ConfirmDialog。 */
export interface PendingJobAction {
  kind: 'cancel' | 'retry';
  job: ServerExecutionJob;
}

export function useExecutionGovernance(scope: ExecutionGovernanceScope = {}) {
  const t = useTranslations('executionGovernance');
  const [jobs, setJobs] = useState<ServerExecutionJob[]>([]);
  const [leases, setLeases] = useState<ServerExecutionLease[]>([]);
  const [supervisor, setSupervisor] = useState<ServerExecutionSupervisorSnapshot | null>(null);
  const [jobStatus, setJobStatus] = useState(scope.jobStatus || 'all');
  const [leaseStatus, setLeaseStatus] = useState(scope.leaseStatus || 'running');
  const [jobLoading, setJobLoading] = useState(true);
  const [leaseLoading, setLeaseLoading] = useState(true);
  const [supervisorLoading, setSupervisorLoading] = useState(true);
  const [supervisorError, setSupervisorError] = useState('');
  const [actingJobId, setActingJobId] = useState('');
  const [processingQueue, setProcessingQueue] = useState(false);
  const [recoveringStale, setRecoveringStale] = useState(false);
  const [actingLease, setActingLease] = useState(false);
  const [error, setError] = useState('');
  const [pendingJobAction, setPendingJobAction] = useState<PendingJobAction | null>(null);

  const loadJobs = usePersistFn(async () => {
    setJobLoading(true);
    try {
      const params = buildExecutionJobParams(jobStatus, scope);
      const nextJobs = await apiRequest<ServerExecutionJob[]>('GET:/server-execution-jobs', params);
      setJobs(nextJobs);
      return nextJobs;
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载执行任务失败');
      return undefined;
    } finally {
      setJobLoading(false);
    }
  });

  const loadLeases = usePersistFn(async () => {
    setLeaseLoading(true);
    try {
      const params = buildExecutionLeaseParams(leaseStatus, scope);
      setLeases(await apiRequest<ServerExecutionLease[]>('GET:/server-execution-leases', params));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载执行占用失败');
    } finally {
      setLeaseLoading(false);
    }
  });

  const loadSupervisor = usePersistFn(async () => {
    setSupervisorLoading(true);
    setSupervisorError('');
    try {
      setSupervisor(
        await apiRequest<ServerExecutionSupervisorSnapshot>(
          'GET:/server-execution-jobs/supervisor',
        ),
      );
    } catch (err) {
      setSupervisor(null);
      setSupervisorError(err instanceof Error ? err.message : '加载 Supervisor 状态失败');
    } finally {
      setSupervisorLoading(false);
    }
  });

  const scopeKey = buildExecutionJobScopeKey(scope);

  /**
   * 静默轮询:不切换 loading 态,直接刷新 jobs/leases/supervisor。
   * 返回是否存在 queued/running 任务,供 SWR refreshInterval 函数形式决定下一轮间隔。
   * 失败时返回 true 保持轮询,下一轮自动重试。
   */
  const refreshSilently = usePersistFn(async () => {
    try {
      const [nextJobs, nextLeases, nextSupervisor] = await Promise.all([
        apiRequest<ServerExecutionJob[]>('GET:/server-execution-jobs', buildExecutionJobParams(jobStatus, scope)),
        apiRequest<ServerExecutionLease[]>('GET:/server-execution-leases', buildExecutionLeaseParams(leaseStatus, scope)),
        apiRequest<ServerExecutionSupervisorSnapshot>('GET:/server-execution-jobs/supervisor'),
      ]);
      setJobs(nextJobs);
      setLeases(nextLeases);
      setSupervisor(nextSupervisor);
      setSupervisorError('');
      return nextJobs.some((job) => job.status === 'queued' || job.status === 'running');
    } catch {
      return true;
    }
  });

  // 存在 queued/running 任务时 5s 轮询,否则暂停;fallbackData 跳过挂载期重复请求。
  const { mutate: syncPollingFlag } = useSWR<boolean>(
    'execution-governance/poll',
    () => refreshSilently(),
    {
      fallbackData: true,
      refreshInterval: (hasActiveJobs) => (hasActiveJobs ? 5000 : 0),
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 4000,
    },
  );

  const loadData = usePersistFn(async () => {
    setError('');
    const [nextJobs] = await Promise.all([loadJobs(), loadLeases(), loadSupervisor()]);
    // 动作/筛选后用最新任务集合同步轮询开关,避免队列有任务时轮询停在关闭态。
    if (nextJobs) {
      void syncPollingFlag(
        nextJobs.some((job) => job.status === 'queued' || job.status === 'running'),
        { revalidate: false },
      );
    }
  });

  useEffect(() => {
    setJobStatus(scope.jobStatus || 'all');
    setLeaseStatus(scope.leaseStatus || 'running');
  }, [scope.jobStatus, scope.leaseStatus]);

  useEffect(() => {
    loadData();
  }, [jobStatus, leaseStatus, scopeKey, loadData]);

  const jobStats = useMemo<JobStats>(
    () => ({
      total: jobs.length,
      queued: jobs.filter((j) => j.status === 'queued').length,
      running: jobs.filter((j) => j.status === 'running').length,
      stale: jobs.filter((j) => isStaleRunning(j)).length,
      blocked: jobs.filter((j) => j.status === 'blocked').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      cancelled: jobs.filter((j) => j.status === 'cancelled').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
    }),
    [jobs],
  );

  const leaseStats = useMemo<LeaseStats>(
    () => ({
      total: leases.length,
      running: leases.filter((l) => l.status === 'running').length,
      blocked: leases.filter((l) => l.status === 'blocked').length,
      expired: leases.filter((l) => l.status === 'expired').length,
      failed: leases.filter((l) => l.status === 'failed').length,
    }),
    [leases],
  );

  const expireStale = usePersistFn(async () => {
    setActingLease(true);
    setError('');
    try {
      await apiRequest('POST:/server-execution-leases/expire-stale', {});
      await loadLeases();
    } catch (err) {
      setError(err instanceof Error ? err.message : '释放过期执行占用失败');
    } finally {
      setActingLease(false);
    }
  });

  const cancelJob = usePersistFn((job: ServerExecutionJob) => {
    setPendingJobAction({ kind: 'cancel', job });
  });

  const retryJob = usePersistFn((job: ServerExecutionJob) => {
    setPendingJobAction({ kind: 'retry', job });
  });

  const cancelJobAction = usePersistFn(() => {
    setPendingJobAction(null);
  });

  const confirmJobAction = usePersistFn(async () => {
    const action = pendingJobAction;
    if (!action) return;
    setActingJobId(action.job.id);
    setError('');
    try {
      if (action.kind === 'cancel') {
        await apiRequest(`POST:/server-execution-jobs/${action.job.id}/cancel`, {});
        await loadJobs();
      } else {
        await apiRequest(`POST:/server-execution-jobs/${action.job.id}/retry`, {
          queue: true,
          maxAttempts: Math.max(action.job.maxAttempts, action.job.attempt + 1),
        });
        await loadData();
      }
      setPendingJobAction(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : action.kind === 'cancel'
            ? t('cancelJobFailed')
            : t('retryJobFailed'),
      );
    } finally {
      setActingJobId('');
    }
  });

  const processNextQueuedJob = usePersistFn(async () => {
    setProcessingQueue(true);
    setError('');
    try {
      await apiRequest('POST:/server-execution-jobs/process-next', {});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理队列任务失败');
    } finally {
      setProcessingQueue(false);
    }
  });

  const recoverStaleJobs = usePersistFn(async () => {
    setRecoveringStale(true);
    setError('');
    try {
      await apiRequest('POST:/server-execution-jobs/recover-stale', {});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复僵尸任务失败');
    } finally {
      setRecoveringStale(false);
    }
  });

  return Object.assign(
    { jobs, leases, supervisor },
    { jobStatus, setJobStatus, leaseStatus, setLeaseStatus },
    { jobLoading, leaseLoading, supervisorLoading, supervisorError },
    { actingJobId, processingQueue, recoveringStale, actingLease, error },
    { jobStats, leaseStats },
    { pendingJobAction },
    { expireStale, cancelJob, retryJob, cancelJobAction, confirmJobAction, processNextQueuedJob, recoverStaleJobs },
    { reload: loadData },
  );
}
