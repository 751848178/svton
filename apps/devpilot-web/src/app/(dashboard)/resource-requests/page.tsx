'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, MetricCard } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useResourceRequests } from './hooks/use-resource-requests';
import { statusLabels } from './constants';
import type { ResourceRequest } from './types';
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
  const [showModal, setShowModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<(typeof requests)[number] | null>(null);
  // 取消/重试交付的确认弹窗状态（参照 teams 的 Modal 确认范式，一个操作一个实例）
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
            onClick={() => setShowModal(true)}
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
            label={statusLabels[status]}
            value={counts[status] || 0}
          />
        ))}
      </div>

      {dataError ? (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {dataError}
        </div>
      ) : null}

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
          onCancel={setCancelTarget}
          onRetryProvisioning={setRetryTarget}
          onComplete={setCompleteTarget}
          onViewRuns={openProvisioningRuns}
        />
      )}

      <SupervisorPanel
        supervisor={runSupervisor}
        error={supervisorError}
        recovering={recoveringStaleRuns}
        processingQueued={processingQueuedRun}
        onRecover={recoverStaleProvisioningRuns}
        onProcessNext={processNextQueuedProvisioningRun}
      />

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

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        tone="danger"
        title={t('cancelConfirmTitle')}
        description={t('cancelConfirmDescription')}
        confirmLabel={t('cancel')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmCancel}
      />

      <ConfirmDialog
        open={Boolean(retryTarget)}
        onOpenChange={(open) => {
          if (!open) setRetryTarget(null);
        }}
        title={t('retryConfirmTitle')}
        description={retryTarget ? t('retryConfirmDescription', { title: retryTarget.title }) : undefined}
        confirmLabel={t('retryDelivery')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmRetry}
      />

      <ConfirmDialog
        open={Boolean(pendingRunAction)}
        onOpenChange={(open) => {
          if (!open) cancelPendingRunAction();
        }}
        tone="warning"
        title={
          pendingRunAction?.kind === 'reconcile'
            ? t('reconcileConfirmTitle')
            : pendingRunAction?.kind === 'recoverStale'
              ? t('recoverStaleConfirmTitle')
              : pendingRunAction?.kind === 'processNext'
                ? t('processNextConfirmTitle')
                : t('replayConfirmTitle')
        }
        description={
          pendingRunAction
            ? pendingRunAction.kind === 'reconcile'
              ? t('reconcileConfirmDescription', { title: runsTarget?.title ?? '' })
              : pendingRunAction.kind === 'recoverStale'
                ? t('recoverStaleConfirmDescription')
                : pendingRunAction.kind === 'processNext'
                  ? t('processNextConfirmDescription')
                  : t('replayConfirmDescription', { title: runsTarget?.title ?? '' })
            : undefined
        }
        confirmLabel={tc('confirm')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmPendingRunAction}
      />
    </div>
  );
}
