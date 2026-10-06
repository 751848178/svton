'use client';

import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useProjectDetail } from '../hooks/use-project-detail';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import { useRepositoryAnalysis } from '../hooks/use-repository-analysis.hooks';
import { projectIdentityFromProject } from '../utils/project-workbench-identity.model';
import { ProjectDeploymentRunsTable } from './project-deployment-runs-table';
import { ProjectDeliveryIssue } from './project-delivery-issue';
import { ProjectWorkbenchHeader } from './project-workbench-header';

/** Project-scoped DeploymentRun history. */
export function ProjectDeploymentsRoute() {
  const t = useTranslations('projects');
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const focusedRunId = searchParams.get('runId')?.trim() || undefined;
  const detail = useProjectDetail(projectId);
  const delivery = useProjectDeliverySummary(projectId);
  const analysis = useRepositoryAnalysis(projectId);

  if (detail.loading) return <LoadingState />;
  if (!detail.project) {
    return (
      <ErrorBanner
        message={detail.error || t('projectNotFound')}
        onRetry={detail.loadProject}
      />
    );
  }

  return (
    <div
      data-project-deployments-root
      className="flex h-[calc(100dvh-11.3125rem)] min-h-0 min-w-0 max-w-full flex-col gap-4 overflow-hidden md:h-[calc(100dvh-10.25rem)] md:gap-6"
      style={{ contain: 'layout paint' }}
    >
      <div className="shrink-0">
        <ProjectWorkbenchHeader
          identity={projectIdentityFromProject(detail.project, analysis)}
          issue={<ProjectDeliveryIssue summary={delivery.summary ?? null} />}
        />
      </div>
      <section className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col">
        <ProjectDeploymentRunsTable
          projectId={projectId}
          environments={detail.project.environments ?? []}
          focusedRunId={focusedRunId}
        />
      </section>
    </div>
  );
}
