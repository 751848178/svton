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
      <EnvironmentPanel detail={detail} />
      <ApplicationsPanel detail={detail} />
      <DeploymentPanel detail={detail} />
      <WebhookPanel detail={detail} />
    </div>
  );
}

function BackToProjectsLink({ label }: { label: string }) {
  return (
    <Link
      href="/projects"
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      {label}
    </Link>
  );
}
