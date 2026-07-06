'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, MetricCard } from '@/components/ui';
import { useResourceRequests } from './hooks/use-resource-requests';
import { statusLabels } from './constants';
import { ProvisioningRunSupervisorPanel as SupervisorPanel } from './components/supervisor-panel';
import { RequestTable } from './components/request-table';
import { CreateRequestModal } from './components/create-request-modal';
import { CompleteRequestModal } from './components/complete-request-modal';
import { ProvisioningRunsModal } from './components/provisioning-runs-modal';

const STATUS_KEYS = ['pending', 'approved', 'completed', 'rejected', 'canceled'] as const;

export default function ResourceRequestsPage() {
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');
  const {
    requests,
    resourceTypes,
    projects,
    loading,
    counts,
    retryingId,
    runsTarget,
    provisioningRuns,
    runsLoading,
    runsError,
    replayingRunId,
    reconcilingRunId,
    runSupervisor,
    supervisorError,
    recoveringStaleRuns,
    processingQueuedRun,
    cancelRequest,
    reviewRequest,
    retryProvisioning,
    openProvisioningRuns,
    replayProvisioningRun,
    reconcileProviderProvisioningRun,
    recoverStaleProvisioningRuns,
    processNextQueuedProvisioningRun,
    closeRuns,
    reload,
  } = useResourceRequests();
  const [showModal, setShowModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<(typeof requests)[number] | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('createRequest')}
          </button>
        }
      />

      <div className="grid grid-cols-5 gap-3">
        {STATUS_KEYS.map((status) => (
          <MetricCard
            key={status}
            label={statusLabels[status]}
            value={counts[status] || 0}
          />
        ))}
      </div>

      <SupervisorPanel
        supervisor={runSupervisor}
        error={supervisorError}
        recovering={recoveringStaleRuns}
        processingQueued={processingQueuedRun}
        onRecover={recoverStaleProvisioningRuns}
        onProcessNext={processNextQueuedProvisioningRun}
      />

      {loading ? (
        <LoadingState text={tc('loading')} />
      ) : requests.length === 0 ? (
        <EmptyState
          text={t('noRequests')}
          description={t('noRequestsDescription')}
        />
      ) : (
        <RequestTable
          requests={requests}
          retryingId={retryingId}
          onReview={reviewRequest}
          onCancel={cancelRequest}
          onRetryProvisioning={retryProvisioning}
          onComplete={setCompleteTarget}
          onViewRuns={openProvisioningRuns}
        />
      )}

      {showModal ? (
        <CreateRequestModal
          resourceTypes={resourceTypes}
          projects={projects}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            reload();
          }}
        />
      ) : null}

      {completeTarget ? (
        <CompleteRequestModal
          request={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onSuccess={() => {
            setCompleteTarget(null);
            reload();
          }}
        />
      ) : null}

      {runsTarget ? (
        <ProvisioningRunsModal
          request={runsTarget}
          runs={provisioningRuns}
          loading={runsLoading}
          error={runsError}
          replayingRunId={replayingRunId}
          reconcilingRunId={reconcilingRunId}
          onReplay={replayProvisioningRun}
          onReconcile={reconcileProviderProvisioningRun}
          onClose={closeRuns}
        />
      ) : null}
    </div>
  );
}
