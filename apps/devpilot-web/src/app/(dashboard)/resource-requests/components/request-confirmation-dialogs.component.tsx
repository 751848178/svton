'use client';

import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { PendingProvisioningAction } from '../hooks/use-provisioning-run-actions';
import type { ResourceRequest } from '../types';
import { PendingRunActionDialog } from './pending-run-action-dialog.component';

export function RequestConfirmationDialogs({
  cancelTarget,
  retryTarget,
  pendingRunAction,
  requestTitle,
  onCancelTargetChange,
  onRetryTargetChange,
  onConfirmCancel,
  onConfirmRetry,
  onCancelPendingRunAction,
  onConfirmPendingRunAction,
}: {
  cancelTarget: string | null;
  retryTarget: ResourceRequest | null;
  pendingRunAction: PendingProvisioningAction | null;
  requestTitle: string;
  onCancelTargetChange: (value: string | null) => void;
  onRetryTargetChange: (value: ResourceRequest | null) => void;
  onConfirmCancel: () => Promise<void>;
  onConfirmRetry: () => Promise<void>;
  onCancelPendingRunAction: () => void;
  onConfirmPendingRunAction: () => void | Promise<void>;
}) {
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');
  return (
    <>
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) onCancelTargetChange(null);
        }}
        tone="danger"
        title={t('cancelConfirmTitle')}
        description={t('cancelConfirmDescription')}
        confirmLabel={t('cancel')}
        cancelLabel={tc('cancel')}
        onConfirm={onConfirmCancel}
      />
      <ConfirmDialog
        open={Boolean(retryTarget)}
        onOpenChange={(open) => {
          if (!open) onRetryTargetChange(null);
        }}
        title={t('retryConfirmTitle')}
        description={
          retryTarget ? t('retryConfirmDescription', { title: retryTarget.title }) : undefined
        }
        confirmLabel={t('retryDelivery')}
        cancelLabel={tc('cancel')}
        onConfirm={onConfirmRetry}
      />
      <PendingRunActionDialog
        action={pendingRunAction}
        requestTitle={requestTitle}
        onOpenChange={(open) => {
          if (!open) onCancelPendingRunAction();
        }}
        onConfirm={onConfirmPendingRunAction}
      />
    </>
  );
}
