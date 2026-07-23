'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState, Tabs } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useProjectDetail } from './hooks/use-project-detail';
import { ProjectDetailHeader } from './components/project-detail-header';
import { OverviewTab } from './components/tabs/overview-tab';
import { DeploymentsTab } from './components/tabs/deployments-tab';
import { EnvironmentsTab } from './components/tabs/environments-tab';
import { WebhooksTab } from './components/tabs/webhooks-tab';
import { ResourcesTab } from './components/tabs/resources-tab';
import { SettingsTab } from './components/tabs/settings-tab';

const DEPLOYMENTS_TAB = 'deployments';

export default function ProjectDetailPage() {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const params = useParams();
  const projectId = params.id as string;
  const detail = useProjectDetail(projectId);
  const [activeKey, setActiveKey] = useState('overview');

  const goToDeployments = () => setActiveKey(DEPLOYMENTS_TAB);

  if (detail.loading) return <LoadingState text={tc('loading')} />;

  if (!detail.project) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('detailTitle')} />
        {detail.error ? (
          <ErrorBanner
            message={detail.error}
            onRetry={() => detail.loadProject()}
            retryLabel={tc('retry')}
          />
        ) : (
          <EmptyState text={t('projectNotFound')} />
        )}
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: t('tabOverview'), children: <OverviewTab detail={detail} onDeployClick={goToDeployments} /> },
    { key: DEPLOYMENTS_TAB, label: t('tabDeployments'), children: <DeploymentsTab detail={detail} /> },
    { key: 'environments', label: t('tabEnvironments'), children: <EnvironmentsTab detail={detail} /> },
    { key: 'webhooks', label: t('tabWebhooks'), children: <WebhooksTab detail={detail} /> },
    { key: 'resources', label: t('tabResources'), children: <ResourcesTab detail={detail} /> },
    { key: 'settings', label: t('tabSettings'), children: <SettingsTab detail={detail} /> },
  ];

  return (
    <div className="space-y-6">
      <ProjectDetailHeader detail={detail} onDeployClick={goToDeployments} />
      <Tabs items={tabs} activeKey={activeKey} onChange={setActiveKey} />
    </div>
  );
}
