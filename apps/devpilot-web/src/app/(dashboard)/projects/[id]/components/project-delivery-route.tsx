'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import { useReleaseOrders } from '../hooks/use-release-orders';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { ProjectDeliveryContent } from './project-delivery-content';
import { ProjectDeliveryHeader } from './project-delivery-header';
import {
  ProjectDeliveryEnvironmentStrip,
  ProjectDeliveryWeakSummary,
} from './project-delivery-summary';
import { ReleaseOrderCreateModal } from './release-order-create-modal';

export function ProjectDeliveryRoute({
  projectId,
  initialSummary,
}: {
  projectId: string;
  initialSummary?: ProjectDeliverySummary;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const delivery = useProjectDeliverySummary(projectId, initialSummary);
  const orders = useReleaseOrders(delivery.summary ? projectId : '');
  const [createOpen, setCreateOpen] = useState(false);
  const isHome = !searchParams.get('releaseOrderId')?.trim();

  if (delivery.loading) return <LoadingState text={tc('loading')} />;
  if (!delivery.summary) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('detailTitle')} />
        {delivery.error ? (
          <ErrorBanner
            message={
              delivery.error instanceof Error ? delivery.error.message : String(delivery.error)
            }
            onRetry={() => void delivery.refresh()}
            retryLabel={tc('retry')}
          />
        ) : (
          <EmptyState text={t('projectNotFound')} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectDeliveryHeader
        summary={delivery.summary}
        showCreate={isHome}
        onCreate={() => setCreateOpen(true)}
      />
      {isHome ? (
        <>
          <ProjectDeliveryWeakSummary summary={delivery.summary} />
          <ProjectDeliveryEnvironmentStrip summary={delivery.summary} />
        </>
      ) : null}
      <ProjectDeliveryContent
        projectId={projectId}
        orders={orders}
      />
      <ReleaseOrderCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orders={orders}
      />
    </div>
  );
}
