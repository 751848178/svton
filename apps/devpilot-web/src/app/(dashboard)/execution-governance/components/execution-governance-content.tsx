'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePersistFn } from '@svton/hooks';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { useExecutionGovernance } from '../hooks/use-execution-governance';
import { SupervisorPanel } from './supervisor-panel';
import { JobList } from './job-list';
import { LeaseList } from './lease-list';
import {
  formatExecutionJobScope,
  readExecutionGovernanceScope,
} from '../execution-governance-scope.utils';

export function ExecutionGovernanceContent() {
  const searchParams = useSearchParams();
  const scope = useMemo(() => readExecutionGovernanceScope(searchParams), [searchParams]);
  const scopeSummary = useMemo(() => formatExecutionJobScope(scope), [scope]);
  const {
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
    reload,
  } = useExecutionGovernance(scope);
  const handleRetry = usePersistFn(() => reload());

  return (
    <div className="space-y-6">
      <PageHeader
        title="执行治理"
        description="查看 Server executor 执行任务、live 占用、阻塞和释放记录"
        actions={
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
              onClick={handleRetry}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              刷新
            </button>
          </div>
        }
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={handleRetry}
        />
      ) : null}

      {scopeSummary ? (
        <div className="rounded-lg border p-4 text-sm">
          <div className="font-medium">执行治理范围</div>
          <div className="mt-2 break-all rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {scopeSummary}
          </div>
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Supervisor</h2>
          <p className="text-sm text-muted-foreground">Server executor queue worker</p>
        </div>
        <SupervisorPanel
          supervisor={supervisor}
          loading={supervisorLoading}
          error={supervisorError}
        />
      </section>

      <JobList
        jobs={jobs}
        loading={jobLoading}
        jobStatus={jobStatus}
        onJobStatusChange={setJobStatus}
        stats={jobStats}
        actingJobId={actingJobId}
        onRetry={retryJob}
        onCancel={cancelJob}
      />

      <LeaseList
        leases={leases}
        loading={leaseLoading}
        leaseStatus={leaseStatus}
        onLeaseStatusChange={setLeaseStatus}
        stats={leaseStats}
      />
    </div>
  );
}
