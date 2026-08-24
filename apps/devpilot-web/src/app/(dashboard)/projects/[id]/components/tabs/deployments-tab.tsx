/**
 * 部署 Tab
 *
 * 单一职责：全宽渲染既有 DeploymentPanel（部署服务选择 + 运行历史，含"查看全部"展开）。
 * 把概览里只展示一条的英雄卡与完整历史分离 —— 概览看最新一条，
 * 这里看全部历史，并在此 tab 内联触发部署向导（A10：不再跳转 /applications）。
 *
 * 复用 DeploymentPanel，不重复实现列表/展开逻辑。
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectApplication, ProjectService } from '../../types';
import { Alert } from '@/components/ui';
import { DeploymentPanel } from '../deployment-panel';

type DetailHook = ReturnType<typeof useProjectDetail>;

interface DeploymentsTabProps {
  detail: DetailHook;
  focusedRunId?: string;
  /** 打开内联部署向导。header 主「部署」按钮（单服务时）与服务行均会调用。 */
  onOpenDeploy?: (application: ProjectApplication, service: ProjectService) => void;
}

export function DeploymentsTab({ detail, focusedRunId, onOpenDeploy }: DeploymentsTabProps) {
  const t = useTranslations('projects');
  const latestRun = detail.deploymentRuns[0];
  // DEP-4：banner 只陈述「最近一次」这一事实——聚焦查看某条历史运行时，
  // 最近一次运行的成败与当前视口无关，不再误把焦点运行说成最近一次。
  const bannerAboutVisibleLatest = !focusedRunId || focusedRunId === latestRun?.id;
  const showLatestFailedBanner =
    latestRun?.status === 'failed' &&
    bannerAboutVisibleLatest &&
    Boolean(
      detail.project?.applications?.some((application) =>
        application.services?.some((service) => service.status === 'active'),
      ),
    );
  return (
    <div className="space-y-3">
      {showLatestFailedBanner ? (
        <Alert tone="warning">{t('deploymentLatestFailedBanner')}</Alert>
      ) : null}
      <DeploymentPanel
        detail={detail}
        focusedRunId={focusedRunId}
        onOpenDeploy={onOpenDeploy}
      />
    </div>
  );
}
