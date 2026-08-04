'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, LinkButton, PageHeader } from '@/components/ui';
import { useProjectDetail } from '../hooks/use-project-detail';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { readDeliveryView, resolveLegacyProjectHref } from '../utils/project-route.utils';
import { ProjectDeliveryContent } from './project-delivery-content';
import { ProjectDeliveryHeader } from './project-delivery-header';
import {
  ProjectDeliveryEnvironmentStrip,
  ProjectDeliveryWeakSummary,
} from './project-delivery-summary';
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

function ProjectDeliveryRoute({
  projectId,
  initialSummary,
}: {
  projectId: string;
  initialSummary?: ProjectDeliverySummary;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const delivery = useProjectDeliverySummary(projectId, initialSummary);
  const [createOpen, setCreateOpen] = useState(false);
  const isHome = !searchParams.get('releaseOrderId')?.trim();
  if (delivery.loading) return <LoadingState text={tc('loading')} />;
  if (!delivery.summary) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('detailTitle')} />
        {delivery.error ? (
          <ErrorBanner
            message={
              delivery.error instanceof Error ? delivery.error.message : String(delivery.error)
            }
            onRetry={() => void delivery.refresh()}
            retryLabel={tc('retry')}
          />
        ) : (
          <EmptyState text={t('projectNotFound')} />
        )}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <ProjectDeliveryHeader
        summary={delivery.summary}
        showCreate={isHome}
        onCreate={() => setCreateOpen(true)}
      />
      {isHome ? (
        <>
          <ProjectDeliveryWeakSummary summary={delivery.summary} />
          <ProjectDeliveryEnvironmentStrip summary={delivery.summary} />
        </>
      ) : null}
      <ProjectDeliveryContent
        projectId={projectId}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
    </div>
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

  return (
    <div className="space-y-6">
      <ProjectDetailHeader
        detail={detail}
        actions={
          <LinkButton
            href={
              mode === 'settings'
                ? `/projects/${encodeURIComponent(projectId)}`
                : `/projects/${encodeURIComponent(projectId)}/settings`
            }
            variant="outline"
          >
            {mode === 'settings' ? t('backToProjectDelivery') : t('manageProject')}
          </LinkButton>
        }
      />
      {mode === 'settings' ? (
        <ProjectSettingsContent detail={detail} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('professionalDeploymentView')}</p>
          <ReleaseDeliveryCompatibilityBanner projectId={projectId} />
          <DeploymentsTab
            detail={detail}
            focusedRunId={searchParams.get('runId')?.trim() || undefined}
          />
        </div>
      )}
    </div>
  );
}
