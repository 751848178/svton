'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { EmptyState, ErrorBanner } from '@/components/ui';
import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { deploymentRunHref, releaseOrderHref } from '../utils/project-route.utils';
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
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('releaseOrderColumnOrder')}</th>
                <th className="px-4 py-3 font-medium">{t('releaseOrderColumnStatus')}</th>
                <th className="px-4 py-3 font-medium">{t('releaseOrderColumnSource')}</th>
                <th className="px-4 py-3 font-medium">{t('releaseOrderColumnStage')}</th>
                <th className="px-4 py-3 font-medium">{t('releaseOrderColumnUpdated')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('releaseOrderColumnActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.items.map((item) => (
                <ReleaseOrderListRow
                  key={item.id}
                  item={item}
                  onOpen={() =>
                    router.replace(releaseOrderHref(projectId, item.id, null, searchParams))
                  }
                  onOpenBuild={() =>
                    router.replace(
                      releaseOrderHref(projectId, item.id, 'build', searchParams, {
                        buildRunId: item.source.buildRunId ?? undefined,
                      }),
                    )
                  }
                  onOpenDeployment={() =>
                    item.deployment.latest
                      ? router.replace(
                          deploymentRunHref(
                            projectId,
                            item.deployment.latest.id,
                            item.id,
                          ),
                        )
                      : undefined
                  }
                  onOpenEvidence={() =>
                    router.replace(
                      releaseOrderHref(projectId, item.id, 'build', searchParams, {
                        buildRunId: item.build.recentSuccessfulManifest?.buildRunId,
                      }),
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
