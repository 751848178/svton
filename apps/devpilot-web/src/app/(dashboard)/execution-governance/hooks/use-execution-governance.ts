/**
 * 执行治理数据 Hook
 *
 * 单一职责：加载 Job/Lease/Supervisor，计算统计，提供取消/重试/队列/恢复操作。
 */

import { useEffect, useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { ServerExecutionJob, ServerExecutionLease } from '../types';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';
import { isStaleRunning } from '../utils';

export interface JobStats {
  total: number;
  queued: number;
  running: number;
  stale: number;
  blocked: number;
  failed: number;
  cancelled: number;
}

export interface LeaseStats {
  total: number;
  running: number;
  blocked: number;
  expired: number;
  failed: number;
}

export function useExecutionGovernance() {
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

  const loadJobs = usePersistFn(async () => {
    setJobLoading(true);
    try {
      const params = jobStatus === 'all' ? undefined : { status: jobStatus };
      setJobs(await apiRequest<ServerExecutionJob[]>('GET:/server-execution-jobs', params));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载执行任务失败');
    } finally {
      setJobLoading(false);
    }
  });

  const loadLeases = usePersistFn(async () => {
    setLeaseLoading(true);
    try {
      const params = leaseStatus === 'all' ? undefined : { status: leaseStatus };
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
        await apiRequest<ServerExecutionSupervisorSnapshot>('GET:/server-execution-jobs/supervisor'),
      );
    } catch (err) {
      setSupervisor(null);
      setSupervisorError(err instanceof Error ? err.message : '加载 Supervisor 状态失败');
    } finally {
      setSupervisorLoading(false);
    }
  });

  const loadData = usePersistFn(async () => {
    setError('');
    await Promise.all([loadJobs(), loadLeases(), loadSupervisor()]);
  });

  useEffect(() => {
    loadData();
  }, [jobStatus, leaseStatus, loadData]);

  const jobStats = useMemo<JobStats>(
    () => ({
      total: jobs.length,
      queued: jobs.filter((j) => j.status === 'queued').length,
      running: jobs.filter((j) => j.status === 'running').length,
      stale: jobs.filter((j) => isStaleRunning(j)).length,
      blocked: jobs.filter((j) => j.status === 'blocked').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      cancelled: jobs.filter((j) => j.status === 'cancelled').length,
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

  const cancelJob = usePersistFn(async (job: ServerExecutionJob) => {
    if (!window.confirm(`请求取消执行任务 ${job.operationKey}？`)) return;
    setActingJobId(job.id);
    setError('');
    try {
      await apiRequest(`POST:/server-execution-jobs/${job.id}/cancel`, {});
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消执行任务失败');
    } finally {
      setActingJobId('');
    }
  });

  const retryJob = usePersistFn(async (job: ServerExecutionJob) => {
    if (!window.confirm(`把执行任务 ${job.operationKey} 加入重试队列？`)) return;
    setActingJobId(job.id);
    setError('');
    try {
      await apiRequest(`POST:/server-execution-jobs/${job.id}/retry`, {
        queue: true,
        maxAttempts: Math.max(job.maxAttempts, job.attempt + 1),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试执行任务失败');
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

  return {
    jobs,
    leases,
    supervisor,
    jobStatus,
    setJobStatus,
    leaseStatus,
    setLeaseStatus,
    jobLoading,
    leaseLoading,
    supervisorLoading,
    supervisorError,
    actingJobId,
    processingQueue,
    recoveringStale,
    actingLease,
    error,
    jobStats,
    leaseStats,
    expireStale,
    cancelJob,
    retryJob,
    processNextQueuedJob,
    recoverStaleJobs,
    reload: loadData,
  };
}
