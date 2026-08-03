'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
import { deliveryHref, readDeliveryView } from '../utils/project-route.utils';
import { DeploymentsTab } from './tabs/deployments-tab';
import { EnvironmentVersionsPanel } from './environment-versions-panel';
import { ReleaseOrdersPanel } from './release-orders-panel';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectDeliveryContent({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = detail.project?.id ?? '';
  const view = readDeliveryView(searchParams);

  if (view === 'deployments') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('professionalDeploymentView')}</p>
        <DeploymentsTab
          detail={detail}
          focusedRunId={searchParams.get('runId')?.trim() || undefined}
          onOpenDeploy={() => undefined}
        />
      </div>
    );
  }

  return (
    <Tabs
      items={[
        {
          key: 'releases',
          label: t('tabReleaseOrders'),
          children: <ReleaseOrdersPanel projectId={projectId} />,
        },
        {
          key: 'environment-versions',
          label: t('tabEnvironmentVersions'),
          children: <EnvironmentVersionsPanel detail={detail} />,
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
