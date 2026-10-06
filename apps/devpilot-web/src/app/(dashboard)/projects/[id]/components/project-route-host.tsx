'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useProjectDetail } from '../hooks/use-project-detail';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import { useRepositoryAnalysis } from '../hooks/use-repository-analysis.hooks';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import {
  deploymentRunRedirectHref,
  releasesViewRedirectHref,
  resolveLegacyProjectHref,
  resolveUnknownViewHref,
} from '../utils/project-route.utils';
import { legacyReleaseDetailHref } from '../utils/project-release-route.model';
import { repositoryAnalysisPageHref } from '../utils/project-repository-analysis-route';
import { projectIdentityFromProject } from '../utils/project-workbench-identity.model';
import { ProjectDeliveryRoute } from './project-delivery-route';
import { ProjectDeliveryIssue } from './project-delivery-issue';
import { ProjectSettingsContent } from './project-settings-content';
import { ProjectWorkbenchHeader } from './project-workbench-header';

export function ProjectRouteHost({
  mode,
  initialSummary,
}: {
  mode: 'delivery' | 'settings';
  initialSummary?: ProjectDeliverySummary;
}) {
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const legacyHref = resolveLegacyProjectHref(projectId, searchParams);
  const legacyDetailHref = legacyReleaseDetailHref(projectId, searchParams);
  // IA 重构：发布与部署记录迁出 ?view= query 形态（发布=独立页面 /releases，
  // 部署记录跟随发布单）。旧深链显式 302 纠正，不静默回退。
  const releasesHref =
    mode === 'delivery' && searchParams.get('view') === 'releases'
      ? releasesViewRedirectHref(projectId, searchParams)
      : null;
  const deploymentsHref =
    mode === 'delivery' && searchParams.get('view') === 'deployments'
      ? deploymentRunRedirectHref(projectId, searchParams)
      : null;
  const unknownViewHref =
    mode === 'delivery' &&
    !releasesHref &&
    !deploymentsHref &&
    !legacyHref &&
    !legacyDetailHref &&
    searchParams.get('create') !== 'true'
      ? resolveUnknownViewHref(projectId, searchParams)
      : null;

  useEffect(() => {
    if (legacyHref) router.replace(legacyHref);
  }, [legacyHref, router]);

  // EV-1：不支持的 view 显式纠正 URL，而不是静默回退到项目信息。
  useEffect(() => {
    if (!legacyHref && unknownViewHref) router.replace(unknownViewHref);
  }, [legacyHref, unknownViewHref, router]);

  useEffect(() => {
    if (!legacyHref && !legacyDetailHref && releasesHref) router.replace(releasesHref);
  }, [legacyDetailHref, legacyHref, releasesHref, router]);

  useEffect(() => {
    if (!legacyHref && !legacyDetailHref && deploymentsHref) router.replace(deploymentsHref);
  }, [deploymentsHref, legacyDetailHref, legacyHref, router]);

  useEffect(() => {
    if (!legacyHref && legacyDetailHref) router.replace(legacyDetailHref);
  }, [legacyDetailHref, legacyHref, router]);

  if (legacyHref || legacyDetailHref || releasesHref || deploymentsHref || unknownViewHref) {
    return <LoadingState text={tc('loading')} />;
  }
  if (mode === 'settings') return <ProjectDetailRoute projectId={projectId} />;
  return (
    <ProjectDeliveryRoute
      projectId={projectId}
      initialSummary={initialSummary}
    />
  );
}

function ProjectDetailRoute({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const detail = useProjectDetail(projectId);
  const delivery = useProjectDeliverySummary(projectId);
  const analysis = useRepositoryAnalysis(projectId);
  if (detail.loading) return <LoadingState text={tc('loading')} />;
  if (!detail.project) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('detailTitle')} />
        {detail.error ? (
          <ErrorBanner
            message={detail.error}
            onRetry={detail.loadProject}
            retryLabel={tc('retry')}
          />
        ) : (
          <EmptyState text={t('projectNotFound')} />
        )}
      </div>
    );
  }

  const project = detail.project;
  const header = (
    <ProjectWorkbenchHeader
      identity={projectIdentityFromProject(project, analysis)}
      issue={<ProjectDeliveryIssue summary={delivery.summary ?? null} />}
    />
  );

  return (
    <div className="space-y-6">
      {header}
      <ProjectSettingsContent
        detail={detail}
        analysis={analysis}
        onRepositoryRunCreated={(runId) =>
          router.push(repositoryAnalysisPageHref(projectId, runId))
        }
      />
    </div>
  );
}
