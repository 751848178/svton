'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import { deliveryHref, readDeliveryView } from '../utils/project-route.utils';
import { EnvironmentVersionsPanel } from './environment-versions-panel';
import { ReleaseOrdersPanel } from './release-orders-panel';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';

export function ProjectDeliveryContent({
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
  const view = readDeliveryView(searchParams);

  if (searchParams.get('releaseOrderId')?.trim()) {
    return (
      <ReleaseOrdersPanel
        projectId={projectId}
        orders={orders}
        summary={summary}
      />
    );
  }

  return (
    <Tabs
      items={[
        {
          key: 'releases',
          label: t('tabReleaseOrders'),
          children: (
            <ReleaseOrdersPanel
              projectId={projectId}
              orders={orders}
              summary={summary}
            />
          ),
        },
        {
          key: 'environment-versions',
          label: t('tabEnvironmentVersions'),
          children: <EnvironmentVersionsPanel projectId={projectId} />,
        },
      ]}
      activeKey={view}
      onChange={(next) =>
        router.replace(
          deliveryHref(projectId, next as 'releases' | 'environment-versions', searchParams),
          { scroll: false },
        )
      }
    />
  );
}
