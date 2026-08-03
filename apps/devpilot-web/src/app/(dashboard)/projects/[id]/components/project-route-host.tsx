'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, LinkButton, PageHeader } from '@/components/ui';
import { useProjectDetail } from '../hooks/use-project-detail';
import { resolveLegacyProjectHref } from '../utils/project-route.utils';
import { ProjectDeliveryContent } from './project-delivery-content';
import { ProjectDetailHeader } from './project-detail-header';
import { ProjectSettingsContent } from './project-settings-content';

export function ProjectRouteHost({ mode }: { mode: 'delivery' | 'settings' }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const legacyHref = resolveLegacyProjectHref(projectId, searchParams);
  const runId = searchParams.get('runId')?.trim() || undefined;
  const detail = useProjectDetail(projectId, runId);

  useEffect(() => {
    if (legacyHref) router.replace(legacyHref);
  }, [legacyHref, router]);

  if (legacyHref || detail.loading) return <LoadingState text={tc('loading')} />;
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

  const actions =
    mode === 'delivery' ? (
      <LinkButton
        href={`/projects/${encodeURIComponent(projectId)}/settings`}
        variant="outline"
      >
        {t('manageProject')}
      </LinkButton>
    ) : (
      <LinkButton
        href={`/projects/${encodeURIComponent(projectId)}`}
        variant="outline"
      >
        {t('backToProjectDelivery')}
      </LinkButton>
    );

  return (
    <div className="space-y-6">
      <ProjectDetailHeader
        detail={detail}
        actions={actions}
      />
      {mode === 'delivery' ? (
        <ProjectDeliveryContent detail={detail} />
      ) : (
        <ProjectSettingsContent detail={detail} />
      )}
    </div>
  );
}
