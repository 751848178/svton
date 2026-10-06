'use client';

import React, { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import { useProjectDetail } from '../hooks/use-project-detail';
import { useRepositoryAnalysis } from '../hooks/use-repository-analysis.hooks';
import { useReleaseOrders } from '../hooks/use-release-orders';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { legacyReleaseDetailHref } from '../utils/project-release-route.model';
import { legacyRepositoryAnalysisRunHref } from '../utils/project-repository-analysis-route';
import {
  projectIdentityFromProject,
  projectIdentityFromSummary,
} from '../utils/project-workbench-identity.model';
import { ProjectDeliveryIssue } from './project-delivery-issue';
import { ProjectOverviewContent } from './project-overview-content';
import { ProjectWorkbenchHeader } from './project-workbench-header';
import { ReleaseOrderCreateModal } from './release-order-create-modal';

export function ProjectDeliveryRoute({
  projectId: projectIdProp,
  initialSummary,
}: {
  projectId?: string;
  initialSummary?: ProjectDeliverySummary;
}) {
  // 路径页（/releases）薄包装不传参 → 从路由参数自取。
  const params = useParams();
  const projectId = projectIdProp ?? (params.id as string);
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const delivery = useProjectDeliverySummary(projectId, initialSummary);
  const detail = useProjectDetail(projectId);
  const analysis = useRepositoryAnalysis(projectId);
  const orders = useReleaseOrders(delivery.summary ? projectId : '');
  const [createOpen, setCreateOpen] = useState(false);
  const legacyDetailHref = legacyReleaseDetailHref(projectId, searchParams);
  const legacyAnalysisHref = legacyRepositoryAnalysisRunHref(projectId, searchParams);

  useEffect(() => {
    if (searchParams.get('create') === 'true') setCreateOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (legacyDetailHref) router.replace(legacyDetailHref, { scroll: false });
  }, [legacyDetailHref, router]);

  useEffect(() => {
    if (legacyAnalysisHref) router.replace(legacyAnalysisHref, { scroll: false });
  }, [legacyAnalysisHref, router]);

  // 关闭弹窗必须同步清掉 create=true，否则 URL 不变导致「创建发布」
  // 二次点击时 effect 不再触发，弹窗永远打不开（走查 WIZ-2）。
  const closeCreateModal = () => {
    setCreateOpen(false);
    if (searchParams.get('create') !== 'true') return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  if (legacyDetailHref || legacyAnalysisHref || delivery.loading || detail.loading)
    return <LoadingState text={tc('loading')} />;
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
      <ProjectWorkbenchHeader
        identity={
          detail.project
            ? projectIdentityFromProject(detail.project, analysis)
            : projectIdentityFromSummary(delivery.summary, analysis)
        }
        issue={<ProjectDeliveryIssue summary={delivery.summary} />}
      />
      <ProjectOverviewContent
        detail={detail}
        analysis={analysis}
        orders={orders}
      />
      <ReleaseOrderCreateModal
        open={createOpen}
        onClose={closeCreateModal}
        orders={orders}
      />
    </div>
  );
}
