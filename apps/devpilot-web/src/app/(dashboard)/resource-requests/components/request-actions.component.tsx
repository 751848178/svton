'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import type { ResourceRequest } from '../types';
import { canRetryProvisioning, canViewProvisioningRuns } from '../badges';

interface RequestActionsProps {
  request: ResourceRequest;
  retryingId: string | null;
  onReview: (id: string, status: 'approved' | 'rejected') => void;
  onCancel: (id: string) => void;
  onRetryProvisioning: (request: ResourceRequest) => void;
  onComplete: (request: ResourceRequest) => void;
  onViewRuns: (request: ResourceRequest) => void;
}

export function RequestActions({
  request,
  retryingId,
  onReview,
  onCancel,
  onRetryProvisioning,
  onComplete,
  onViewRuns,
}: RequestActionsProps) {
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');
  const handleApprove = usePersistFn(() => onReview(request.id, 'approved'));
  const handleReject = usePersistFn(() => onReview(request.id, 'rejected'));
  const handleCancel = usePersistFn(() => onCancel(request.id));
  const handleRetry = usePersistFn(() => onRetryProvisioning(request));
  const handleComplete = usePersistFn(() => onComplete(request));
  const handleViewRuns = usePersistFn(() => onViewRuns(request));

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canViewProvisioningRuns(request) ? (
        <ActionButton onClick={handleViewRuns}>{t('runRecords')}</ActionButton>
      ) : null}
      {request.status === 'pending' ? (
        <>
          <ActionButton onClick={handleApprove}>{t('approve')}</ActionButton>
          <ActionButton onClick={handleReject}>{t('reject')}</ActionButton>
          <button
            onClick={handleCancel}
            className="inline-flex min-h-9 items-center rounded-md px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
          >
            {tc('cancel')}
          </button>
        </>
      ) : null}
      {request.status === 'approved' ? (
        <>
          {canRetryProvisioning(request.result?.provisioning) ? (
            <ActionButton
              disabled={retryingId === request.id}
              onClick={handleRetry}
            >
              {retryingId === request.id ? t('retrying') : t('retryDelivery')}
            </ActionButton>
          ) : null}
          <ActionButton onClick={handleComplete}>{t('deliver')}</ActionButton>
        </>
      ) : null}
      {request.instance ? (
        <Link
          href="/resource-instances"
          className="inline-flex min-h-9 items-center text-sm font-medium text-primary hover:underline"
        >
          {t('instanceName', { name: request.instance.name })}
        </Link>
      ) : null}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-9 items-center rounded-md border px-3 py-1 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
