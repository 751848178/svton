'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { useExecutionGovernance } from './hooks/use-execution-governance';
import { SupervisorPanel } from './components/supervisor-panel';
import { JobList } from './components/job-list';
import { LeaseList } from './components/lease-list';

export default function ExecutionGovernancePage() {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
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
  } = useExecutionGovernance();
  const handleRetry = usePersistFn(() => reload());

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex gap-2">
            <button
              onClick={processNextQueuedJob}
              disabled={processingQueue}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {processingQueue ? t('processing') : t('processQueue')}
            </button>
            <button
              onClick={recoverStaleJobs}
              disabled={recoveringStale}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {recoveringStale ? t('recovering') : t('recoverZombie')}
            </button>
            <button
              onClick={expireStale}
              disabled={actingLease}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {actingLease ? t('processing') : t('releaseExpired')}
            </button>
            <button
              onClick={handleRetry}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              {tc('refresh')}
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
