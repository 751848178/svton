'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import { deliveryHref, readDeliveryView } from '../utils/project-route.utils';
import { EnvironmentVersionsPanel } from './environment-versions-panel';
import { ReleaseOrdersPanel } from './release-orders-panel';

export function ProjectDeliveryContent({
  projectId,
  createOpen,
  onCreateOpenChange,
}: {
  projectId: string;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = readDeliveryView(searchParams);

  return (
    <Tabs
      items={[
        {
          key: 'releases',
          label: t('tabReleaseOrders'),
          children: (
            <ReleaseOrdersPanel
              projectId={projectId}
              createOpen={createOpen}
              onCreateOpenChange={onCreateOpenChange}
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
