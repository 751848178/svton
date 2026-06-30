'use client';

import { useParams } from 'next/navigation';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { useProjectDetail } from './hooks/use-project-detail';
import { ProjectOverviewPanel } from './components/project-overview-panel';
import { EnvironmentPanel } from './components/environment-panel';
import { DeploymentPanel } from './components/deployment-panel';
import { WebhookPanel } from './components/webhook-panel';
import { ApplicationsPanel } from './components/applications-panel';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const detail = useProjectDetail(projectId);

  if (detail.loading) return <LoadingState text="加载中..." />;

  if (!detail.project) {
    return <EmptyState text="项目不存在" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.project.name}
        description="项目详情与管控"
      />
      <ProjectOverviewPanel detail={detail} />
      <EnvironmentPanel detail={detail} />
      <ApplicationsPanel detail={detail} />
      <DeploymentPanel detail={detail} />
      <WebhookPanel detail={detail} />
    </div>
  );
}
