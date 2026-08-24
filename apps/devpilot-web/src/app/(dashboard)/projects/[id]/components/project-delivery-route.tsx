'use client';

import React, { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import { useReleaseOrders } from '../hooks/use-release-orders';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { releaseEnvironmentLabelKey } from '../utils/release-copy.model';
import { ProjectDeliveryContent } from './project-delivery-content';
import { ProjectContextIssue } from './project-context-issue';
import { projectDeliveryActionLabelKey } from './project-delivery-issue.model';
import { projectDeliveryReasonKey } from './project-delivery-reason-copy';
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
  const orders = useReleaseOrders(delivery.summary ? projectId : '');
  const [createOpen, setCreateOpen] = useState(false);
  const isHome = !searchParams.get('releaseOrderId')?.trim();

  useEffect(() => {
    if (searchParams.get('create') === 'true') setCreateOpen(true);
  }, [searchParams]);

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
      {/* 列表页渲染发布页头（标题=发布，动作区沿用项目页头约定）；
          详情页由 ReleaseWorkbenchHeader 作为独立页头（← 返回列表），
          不再叠加项目级页头，避免双层返回与项目动作混入详情语境。 */}
      {isHome ? (
        <ProjectWorkbenchHeader
          projectId={projectId}
          name={t('releasesPageTitle')}
        />
      ) : null}
      {isHome ? <DeliveryIssue summary={delivery.summary} /> : null}
      <ProjectDeliveryContent
        projectId={projectId}
        orders={orders}
        summary={delivery.summary}
      />
      <ReleaseOrderCreateModal
        open={createOpen}
        onClose={closeCreateModal}
        orders={orders}
      />
    </div>
  );
}

function DeliveryIssue({ summary }: { summary: ProjectDeliverySummary }) {
  const t = useTranslations('projects');
  const checkpoint = summary.checkpoints.find((item) => item.status !== 'ready');
  if (!checkpoint?.action || checkpoint.action.kind === 'open_release') return null;
  const scope =
    checkpoint.scope === 'project'
      ? t('projectDeliveryProjectScope')
      : t(releaseEnvironmentLabelKey(checkpoint.scope));
  const reasonKey = projectDeliveryReasonKey(checkpoint.reasonCodes[0]);
  const reason = reasonKey ? t(reasonKey as never) : t('projectDeliveryActionRequiredGeneric');
  return (
    <ProjectContextIssue
      message={t('projectDeliveryIssueMessage', {
        scope,
        reason,
        checkpoint: t(`projectDeliveryCheckpoint_${checkpoint.id}` as never),
      })}
      actionLabel={(
        t as unknown as (key: string, values?: Record<string, string>) => string
      )(projectDeliveryActionLabelKey(checkpoint), { scope })}
      href={checkpoint.action.href}
    />
  );
}
