'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { EmptyState } from '@svton/ui';
import { PageHeader, MetricCard, DataBoundary } from '@/components/ui';
import { useResourceRequests } from './hooks/use-resource-requests';
import { statusLabelKeys } from './constants';
import type { ResourceRequest } from './types';
import { ProvisioningRunSupervisorPanel as SupervisorPanel } from './components/supervisor-panel';
import { RequestTable } from './components/request-table';
import { CreateRequestModal } from './components/create-request-modal';
import { CompleteRequestModal } from './components/complete-request-modal';
import { ProvisioningRunsModal } from './components/provisioning-runs-modal';
import { ProviderStateModal } from './components/provider-state-modal.component';
import { RequestConfirmationDialogs } from './components/request-confirmation-dialogs.component';
import { useResourceRequestEntry } from './hooks/use-resource-request-entry.hooks';

const STATUS_KEYS = ['pending', 'approved', 'completed', 'rejected', 'canceled'] as const;

export default function ResourceRequestsPage() {
  const t = useTranslations('resourceRequests');
  const {
    requests,
    resourceTypes,
    projects,
    environments,
    loading,
    dataError,
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
    pendingRunAction,
    reconcileInputTarget,
    submitReconcileInput,
    cancelReconcileInput,
    cancelRequest,
    reviewRequest,
    retryProvisioning,
    openProvisioningRuns,
    replayProvisioningRun,
    reconcileProviderProvisioningRun,
    recoverStaleProvisioningRuns,
    processNextQueuedProvisioningRun,
    cancelPendingRunAction,
    confirmPendingRunAction,
    closeRuns,
    reload,
  } = useResourceRequests();
  const createEntry = useResourceRequestEntry();
  const [completeTarget, setCompleteTarget] = useState<(typeof requests)[number] | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<ResourceRequest | null>(null);

  const handleConfirmCancel = usePersistFn(async () => {
    if (!cancelTarget) return;
    await cancelRequest(cancelTarget);
    setCancelTarget(null);
  });

  const handleConfirmRetry = usePersistFn(async () => {
    if (!retryTarget) return;
    await retryProvisioning(retryTarget);
    setRetryTarget(null);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <button
            onClick={() => createEntry.setShowModal(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('createRequest')}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {STATUS_KEYS.map((status) => (
          <MetricCard
            key={status}
            label={t(statusLabelKeys[status])}
            value={counts[status] || 0}
          />
        ))}
      </div>

      <DataBoundary
        loading={loading}
        error={dataError}
        onRetry={reload}
      >
        {requests.length === 0 ? (
          <EmptyState
            text={t('noRequests')}
            description={t('noRequestsDescription')}
          />
        ) : (
          <RequestTable
            requests={requests}
            retryingId={retryingId}
            onReview={reviewRequest}
            onCancel={setCancelTarget}
            onRetryProvisioning={setRetryTarget}
            onComplete={setCompleteTarget}
            onViewRuns={openProvisioningRuns}
          />
        )}
      </DataBoundary>

      <SupervisorPanel
        supervisor={runSupervisor}
        error={supervisorError}
        recovering={recoveringStaleRuns}
        processingQueued={processingQueuedRun}
        onRecover={recoverStaleProvisioningRuns}
        onProcessNext={processNextQueuedProvisioningRun}
      />

      {createEntry.showModal ? (
        <CreateRequestModal
          resourceTypes={resourceTypes}
          projects={projects}
          environments={environments}
          defaultProjectId={createEntry.entry.projectId}
          defaultEnvironmentId={createEntry.entry.environmentId}
          onClose={() => createEntry.setShowModal(false)}
          onSuccess={() => {
            reload();
            createEntry.finishCreate();
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

      <ProviderStateModal
        open={Boolean(reconcileInputTarget)}
        onSubmit={submitReconcileInput}
        onCancel={cancelReconcileInput}
      />

      <RequestConfirmationDialogs
        cancelTarget={cancelTarget}
        retryTarget={retryTarget}
        pendingRunAction={pendingRunAction}
        requestTitle={runsTarget?.title ?? ''}
        onCancelTargetChange={setCancelTarget}
        onRetryTargetChange={setRetryTarget}
        onConfirmCancel={handleConfirmCancel}
        onConfirmRetry={handleConfirmRetry}
        onCancelPendingRunAction={cancelPendingRunAction}
        onConfirmPendingRunAction={confirmPendingRunAction}
      />
    </div>
  );
}
