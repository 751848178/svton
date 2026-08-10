'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, LinkButton, PageHeader } from '@/components/ui';
import { useProjectDetail } from '../hooks/use-project-detail';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { readDeliveryView, resolveLegacyProjectHref } from '../utils/project-route.utils';
import { ProjectDeliveryRoute } from './project-delivery-route';
import { ProjectDetailHeader } from './project-detail-header';
import { ProjectSettingsContent } from './project-settings-content';
import { DeploymentsTab } from './tabs/deployments-tab';
import { ReleaseDeliveryCompatibilityBanner } from './release-delivery-compatibility-banner';

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

  useEffect(() => {
    if (legacyHref) router.replace(legacyHref);
  }, [legacyHref, router]);

  if (legacyHref) return <LoadingState text={tc('loading')} />;
  if (mode === 'settings')
    return (
      <ProjectDetailRoute
        projectId={projectId}
        mode="settings"
      />
    );
  if (readDeliveryView(searchParams) === 'deployments') {
    return (
      <ProjectDetailRoute
        projectId={projectId}
        mode="deployments"
      />
    );
  }
  return (
    <ProjectDeliveryRoute
      projectId={projectId}
      initialSummary={initialSummary}
    />
  );
}

function ProjectDetailRoute({
  projectId,
  mode,
}: {
  projectId: string;
  mode: 'settings' | 'deployments';
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const detail = useProjectDetail(
    projectId,
    mode === 'deployments' ? searchParams.get('runId')?.trim() || undefined : undefined,
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

  if (mode === 'settings') return <ProjectSettingsContent detail={detail} />;

  return (
    <div className="space-y-6">
      <ProjectDetailHeader
        detail={detail}
        actions={
          <LinkButton
            href={`/projects/${encodeURIComponent(projectId)}`}
            variant="outline"
          >
            {t('backToProjectDelivery')}
          </LinkButton>
        }
      />
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('professionalDeploymentView')}</p>
        <ReleaseDeliveryCompatibilityBanner projectId={projectId} />
        <DeploymentsTab
          detail={detail}
          focusedRunId={searchParams.get('runId')?.trim() || undefined}
        />
      </div>
    </div>
  );
}
