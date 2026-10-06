'use client';

import React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import { useProjectDetail } from '../hooks/use-project-detail';
import { useRepositoryAnalysis } from '../hooks/use-repository-analysis.hooks';
import { settingsHref } from '../utils/project-route.utils';
import { repositoryAnalysisPageHref } from '../utils/project-repository-analysis-route';
import { projectIdentityFromProject } from '../utils/project-workbench-identity.model';
import { ProjectDeliveryIssue } from './project-delivery-issue';
import { ProjectWorkbenchHeader } from './project-workbench-header';
import { RepositoryAnalysisWorkbench } from './repository-analysis-workbench';

export function ProjectRepositoryAnalysisRoute() {
  const t = useTranslations('projects');
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const focusedRunId = searchParams.get('analysisRunId')?.trim() || undefined;
  const detail = useProjectDetail(projectId);
  const delivery = useProjectDeliverySummary(projectId);
  const analysis = useRepositoryAnalysis(projectId, focusedRunId);

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
    <div className="space-y-6">
      <ProjectWorkbenchHeader
        identity={projectIdentityFromProject(detail.project, analysis)}
        issue={<ProjectDeliveryIssue summary={delivery.summary ?? null} />}
      />
      <RepositoryAnalysisWorkbench
        analysis={analysis}
        settingsHref={settingsHref(projectId, 'repository', searchParams)}
        onSelectRun={(runId) =>
          router.replace(repositoryAnalysisPageHref(projectId, runId), { scroll: false })
        }
      />
    </div>
  );
}
