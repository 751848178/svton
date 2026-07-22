'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useProjectDetail } from './hooks/use-project-detail';
import { ProjectOverviewPanel } from './components/project-overview-panel';
import { EnvironmentPanel } from './components/environment-panel';
import { DeploymentPanel } from './components/deployment-panel';
import { WebhookPanel } from './components/webhook-panel';
import { ApplicationsPanel } from './components/applications-panel';
import { PanelSection } from './components/panel-section';

export default function ProjectDetailPage() {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const params = useParams();
  const projectId = params.id as string;
  const detail = useProjectDetail(projectId);

  if (detail.loading) return <LoadingState text={tc('loading')} />;

  if (!detail.project) {
    if (detail.error) {
      return (
        <div className="space-y-6">
          <PageHeader
            title={t('detailTitle')}
            actions={<BackToProjectsLink label={t('backToProjects')} />}
          />
          <ErrorBanner
            message={detail.error}
            onRetry={() => detail.loadProject()}
            retryLabel={tc('retry')}
          />
        </div>
      );
    }
    // 请求成功但无数据：真空态
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('detailTitle')}
          actions={<BackToProjectsLink label={t('backToProjects')} />}
        />
        <EmptyState text={t('projectNotFound')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.project.name}
        description={t('detailDescription')}
        actions={<BackToProjectsLink label={t('backToProjects')} />}
      />
      <ProjectOverviewPanel detail={detail} />
      <PanelSection
        title={t('deploymentSectionTitle')}
        description={t('deploymentSectionDescription')}
      >
        <ApplicationsPanel detail={detail} />
        <DeploymentPanel detail={detail} />
      </PanelSection>
      <PanelSection
        title={t('integrationSectionTitle')}
        description={t('integrationSectionDescription')}
      >
        <EnvironmentPanel detail={detail} />
        <WebhookPanel detail={detail} />
      </PanelSection>
    </div>
  );
}

function BackToProjectsLink({ label }: { label: string }) {
  return (
    <Link href="/projects" className="link text-sm">
      {label}
    </Link>
  );
}
