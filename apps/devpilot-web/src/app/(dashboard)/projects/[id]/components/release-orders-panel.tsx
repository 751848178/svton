'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { EmptyState, ErrorBanner } from '@/components/ui';
import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { releaseOrderHref } from '../utils/project-route.utils';
import { ReleaseOrderDetailPanel } from './release-order-detail-panel';
import { ReleaseOrderListRow } from './release-order-list-row';
import { ReleaseOrderListToolbar } from './release-order-list-toolbar';

export function ReleaseOrdersPanel({
  projectId,
  orders,
  summary,
}: {
  projectId: string;
  orders: ReleaseOrdersHook;
  summary?: ProjectDeliverySummary;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const releaseOrderId = searchParams.get('releaseOrderId')?.trim();

  if (releaseOrderId) {
    return (
      <ReleaseOrderDetailPanel
        key={scopedRequestIdentity(projectId, releaseOrderId)}
        projectId={projectId}
        releaseOrderId={releaseOrderId}
        projectSummary={summary}
        onOrdersChanged={orders.load}
      />
    );
  }

  const filtered = Boolean(orders.query.trim() || orders.status);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('releaseOrdersTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('releaseOrdersDescription')}</p>
      </div>
      <ReleaseOrderListToolbar
        query={orders.query}
        status={orders.status}
        total={orders.total}
        onQueryChange={orders.setQuery}
        onStatusChange={orders.setStatus}
      />
      {orders.error ? (
        <ErrorBanner
          message={orders.error}
          onRetry={orders.load}
        />
      ) : null}
      {orders.loading ? <LoadingState /> : null}
      {!orders.loading && orders.items.length === 0 ? (
        <EmptyState title={t(filtered ? 'releaseOrdersFilteredEmpty' : 'releaseOrdersEmpty')} />
      ) : null}
      {!orders.loading && orders.items.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="hidden grid-cols-[minmax(240px,1.3fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(230px,1.2fr)] gap-5 bg-muted/40 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
            <span>{t('releaseOrderColumnOrder')}</span>
            <span>{t('releaseOrderColumnBuild')}</span>
            <span>{t('releaseOrderColumnDeployment')}</span>
            <span>{t('releaseOrderColumnLastExecution')}</span>
          </div>
          {orders.items.map((item) => (
            <ReleaseOrderListRow
              key={item.id}
              item={item}
              onOpen={() =>
                router.replace(releaseOrderHref(projectId, item.id, null, searchParams))
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
