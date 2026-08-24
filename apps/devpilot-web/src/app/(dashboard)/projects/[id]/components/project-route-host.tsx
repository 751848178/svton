'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useProjectDetail } from '../hooks/use-project-detail';
import { useRepositoryAnalysis } from '../hooks/use-repository-analysis.hooks';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import {
  deploymentRunRedirectHref,
  releasesViewRedirectHref,
  resolveLegacyProjectHref,
  resolveUnknownViewHref,
} from '../utils/project-route.utils';
import { ProjectDeliveryRoute } from './project-delivery-route';
import { ProjectInformationPanel } from './project-information-panel';
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
    !searchParams.get('releaseOrderId') &&
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
    if (!legacyHref && releasesHref) router.replace(releasesHref);
  }, [legacyHref, releasesHref, router]);

  useEffect(() => {
    if (!legacyHref && deploymentsHref) router.replace(deploymentsHref);
  }, [legacyHref, deploymentsHref, router]);

  if (legacyHref || releasesHref || deploymentsHref || unknownViewHref) {
    return <LoadingState text={tc('loading')} />;
  }
  if (mode === 'settings')
    return (
      <ProjectDetailRoute
        projectId={projectId}
        mode="settings"
      />
    );
  if (searchParams.get('releaseOrderId') || searchParams.get('create') === 'true') {
    return (
      <ProjectDeliveryRoute
        projectId={projectId}
        initialSummary={initialSummary}
      />
    );
  }
  return (
    <ProjectDetailRoute
      projectId={projectId}
      mode="information"
    />
  );
}

function ProjectDetailRoute({
  projectId,
  mode,
}: {
  projectId: string;
  mode: 'information' | 'settings';
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const detail = useProjectDetail(projectId);
  const analysis = useRepositoryAnalysis(
    projectId,
    searchParams.get('analysisRunId')?.trim() || undefined,
  );
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
  const header = <ProjectWorkbenchHeader
    projectId={projectId}
    name={project.name}
  />;

  if (mode === 'settings')
    return (
      <div className="space-y-6">
        {header}
        <ProjectSettingsContent detail={detail} />
      </div>
    );

  if (mode === 'information') {
    return (
      <div className="space-y-6">
        {header}
        <ProjectInformationPanel
          detail={detail}
          analysis={analysis}
          onSelectAnalysisRun={(runId) => {
            const next = new URLSearchParams(searchParams);
            next.set('analysisRunId', runId);
            router.replace(`/projects/${encodeURIComponent(projectId)}?${next.toString()}`, {
              scroll: false,
            });
          }}
        />
      </div>
    );
  }

}
