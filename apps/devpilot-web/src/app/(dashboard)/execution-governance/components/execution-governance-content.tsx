'use client';

import { Suspense as ReactSuspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState } from '@svton/ui';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useExecutionGovernance } from '../hooks/use-execution-governance';
import { GovernanceOverview } from './overview-cards';
import { SupervisorPanel } from './supervisor-panel';
import { JobList } from './job-list';
import { LeaseList } from './lease-list';
import {
  formatExecutionJobScope,
  readExecutionGovernanceScope,
} from '../execution-governance-scope.utils';

const Suspense = ReactSuspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

export function ExecutionGovernanceContent() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<LoadingState text={tc('loading')} />}>
      <ExecutionGovernanceInner />
    </Suspense>
  );
}

function ExecutionGovernanceInner() {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
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
    pendingJobAction,
    expireStale,
    cancelJob,
    retryJob,
    cancelJobAction,
    confirmJobAction,
    processNextQueuedJob,
    recoverStaleJobs,
    reload,
  } = useExecutionGovernance(scope);
  const handleRetry = usePersistFn(() => reload());

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={processNextQueuedJob}
              disabled={processingQueue}
              className="min-h-11 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50"
            >
              {processingQueue ? t('processing') : t('processQueue')}
            </button>
            <button
              onClick={recoverStaleJobs}
              disabled={recoveringStale}
              className="min-h-11 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50"
            >
              {recoveringStale ? t('recovering') : t('recoverZombie')}
            </button>
            <button
              onClick={expireStale}
              disabled={actingLease}
              className="min-h-11 rounded-md border px-3 text-sm hover:bg-accent disabled:opacity-50"
            >
              {actingLease ? t('processing') : t('releaseExpired')}
            </button>
            <button
              onClick={handleRetry}
              className="min-h-11 rounded-md border px-3 text-sm hover:bg-accent"
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

      {scopeSummary ? (
        <div className="rounded-lg border p-4 text-sm">
          <div className="font-medium">{t('governanceScope')}</div>
          <div className="mt-2 break-all rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {scopeSummary}
          </div>
        </div>
      ) : null}

      <GovernanceOverview
        supervisor={supervisor}
        jobStats={jobStats}
        leaseStats={leaseStats}
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Supervisor</h2>
          <p className="text-sm text-muted-foreground">{t('supervisorSubtitle')}</p>
        </div>
        <SupervisorPanel
          supervisor={supervisor}
          loading={supervisorLoading}
          error={supervisorError}
          onRetry={handleRetry}
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

      <ConfirmDialog
        open={Boolean(pendingJobAction)}
        onOpenChange={(open) => {
          if (!open) cancelJobAction();
        }}
        tone="warning"
        title={
          pendingJobAction?.kind === 'cancel' ? t('cancelJobTitle') : t('retryJobTitle')
        }
        description={
          pendingJobAction
            ? pendingJobAction.kind === 'cancel'
              ? t('cancelJobDescription', { operationKey: pendingJobAction.job.operationKey })
              : t('retryJobDescription', { operationKey: pendingJobAction.job.operationKey })
            : undefined
        }
        confirmLabel={tc('confirm')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmJobAction}
      />
    </div>
  );
}
