'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { Button, ErrorBanner, StatusTag } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import { useReleaseOrders } from '../hooks/use-release-orders';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseOrderCreateModal } from './release-order-create-modal';

export function ReleaseOrdersPanel({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const orders = useReleaseOrders(projectId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('releaseOrdersTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('releaseOrdersDescription')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t('createReleaseOrder')}</Button>
      </div>
      {orders.error ? (
        <ErrorBanner
          message={orders.error}
          onRetry={orders.load}
        />
      ) : null}
      {orders.loading ? <LoadingState /> : null}
      {!orders.loading && orders.items.length === 0 ? (
        <EmptyState text={t('releaseOrdersEmpty')} />
      ) : null}
      <div className="space-y-3">
        {orders.items.map((order) => (
          <article
            key={order.id}
            className="rounded-lg border p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{order.releaseVersion}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.note || t('releaseOrderNoNote')}
                </p>
              </div>
              <StatusTag
                status={releaseOrderStatusTone(order.status)}
                label={t(`releaseOrderStatus${statusKey(order.status)}`)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span>{t('releaseOrderCreatedAt', { time: formatDateTime(order.createdAt) })}</span>
              <span>{t('releaseOrderBuildCount', { count: order.counts.buildRuns })}</span>
              <span>{t('releaseOrderManifestCount', { count: order.counts.manifests })}</span>
            </div>
          </article>
        ))}
      </div>
      <ReleaseOrderCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orders={orders}
      />
    </div>
  );
}

function statusKey(status: string) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}
