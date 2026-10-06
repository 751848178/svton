'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { EmptyState, ErrorBanner } from '@/components/ui';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import { releaseOrderHref } from '../utils/project-route.utils';
import { ReleaseOrderListRow } from './release-order-list-row';
import { ReleaseOrderListToolbar } from './release-order-list-toolbar';
import { PROJECT_TABLE_CLASS, ProjectTableSurface } from './project-workbench-surface';

export function ReleaseOrdersPanel({
  projectId,
  orders,
  embedded = false,
}: {
  projectId: string;
  orders: ReleaseOrdersHook;
  embedded?: boolean;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtered = Boolean(orders.query.trim() || orders.status);

  return (
    <>
      <ProjectTableSurface
        variant={embedded ? 'embedded' : 'card'}
        title={embedded ? undefined : t('releaseRecordsTitle')}
        description={embedded ? undefined : t('releaseOrderListSummary', { count: orders.total })}
        actions={
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <ReleaseOrderListToolbar
              query={orders.query}
              status={orders.status}
              total={orders.total}
              onQueryChange={orders.setQuery}
              onStatusChange={orders.setStatus}
            />
          </div>
        }
      >
        {orders.error ? (
          <div className="p-4">
            <ErrorBanner
              message={orders.error}
              onRetry={orders.load}
            />
          </div>
        ) : null}
        {orders.loading ? <LoadingState /> : null}
        {!orders.loading && orders.items.length === 0 ? (
          <div className="p-6">
            <EmptyState title={t(filtered ? 'releaseOrdersFilteredEmpty' : 'releaseOrdersEmpty')} />
          </div>
        ) : null}
        {!orders.loading && orders.items.length > 0 ? (
          <table className={`${PROJECT_TABLE_CLASS} min-w-[880px]`}>
            <thead>
              <tr>
                <th>{t('releaseOrderColumnOrder')}</th>
                <th>{t('releaseOrderColumnStatus')}</th>
                <th>{t('releaseOrderColumnSource')}</th>
                <th>{t('releaseOrderColumnStage')}</th>
                <th>{t('releaseOrderColumnUpdated')}</th>
                <th className="text-right">{t('releaseOrderColumnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.items.map((item) => (
                <ReleaseOrderListRow
                  key={item.id}
                  item={item}
                  onOpen={() =>
                    router.push(releaseOrderHref(projectId, item.id, null, searchParams))
                  }
                />
              ))}
            </tbody>
          </table>
        ) : null}
      </ProjectTableSurface>
    </>
  );
}
