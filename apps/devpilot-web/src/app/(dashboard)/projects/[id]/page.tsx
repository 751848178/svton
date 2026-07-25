'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState, Tabs } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { useProjectDetail } from './hooks/use-project-detail';
import { useProjectDeployOperations } from './hooks/use-project-deploy-operations';
import { ProjectDetailHeader } from './components/project-detail-header';
import {
  useProjectDeployWizardHost,
  ProjectDeployWizardModal,
} from './components/deploy-wizard-host';
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

  // 所有 hook 必须在任何 early return 之前调用（rules-of-hooks）。
  const operations = useProjectDeployOperations({
    projectId,
    reload: detail.loadDeploymentRuns,
  });
  const deployHost = useProjectDeployWizardHost({
    projectId,
    // project 名为空时 host 仍可挂载，仅 onOpenDeploy 的 application.project.name 回退。
    projectName: detail.project?.name ?? '',
    environments: detail.project?.environments ?? [],
    operations,
  });

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

  const p = detail.project;
  const apps = p.applications ?? [];
  // 收集全部应用下的服务（扁平），用于判断「单应用单服务」快捷路径。
  const allServices = apps.flatMap((app) => app.services?.map((svc) => ({ app, svc })) ?? []);

  const handleHeaderDeploy = () => {
    // A10：主「部署」按钮不跳转。
    //  - 单应用单服务 → 直接打开内联向导。
    //  - 否则 → 滚到部署 tab + toast，引导用户在服务行里选目标。
    if (allServices.length === 1) {
      const { app, svc } = allServices[0];
      deployHost.onOpenDeploy(app, svc);
      return;
    }
    goToDeployments();
    if (allServices.length > 1) feedback.success(t('selectServiceToDeploy'));
  };

  const tabs = [
    { key: 'overview', label: t('tabOverview'), children: <OverviewTab detail={detail} onDeployClick={goToDeployments} /> },
    {
      key: DEPLOYMENTS_TAB,
      label: t('tabDeployments'),
      children: <DeploymentsTab detail={detail} onOpenDeploy={deployHost.onOpenDeploy} />,
    },
    { key: 'environments', label: t('tabEnvironments'), children: <EnvironmentsTab detail={detail} /> },
    { key: 'webhooks', label: t('tabWebhooks'), children: <WebhooksTab detail={detail} /> },
    { key: 'resources', label: t('tabResources'), children: <ResourcesTab detail={detail} /> },
    { key: 'settings', label: t('tabSettings'), children: <SettingsTab detail={detail} /> },
  ];

  return (
    <div className="space-y-6">
      <ProjectDetailHeader
        detail={detail}
        onDeployClick={handleHeaderDeploy}
        onDeployHistoryClick={goToDeployments}
      />
      <Tabs items={tabs} activeKey={activeKey} onChange={setActiveKey} />
      <ProjectDeployWizardModal host={deployHost} />
    </div>
  );
}
