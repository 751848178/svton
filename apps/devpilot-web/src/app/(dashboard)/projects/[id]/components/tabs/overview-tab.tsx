/**
 * 概览 Tab
 *
 * 单一职责：组合「最近部署英雄卡」+「关联应用」+「环境」三块，
 * 给出页面的第一焦点（最近部署结果如何）与两份精简摘要。
 *
 * 全量部署历史、Webhook、资源、设置分别放在各自的 Tab，
 * 概览只承担"项目当前状态快照"。
 *
 * 复用既有 ApplicationsPanel / EnvironmentPanel（已是摘要粒度的列表），
 * 不重复实现其内部，仅做布局编排。
 */

'use client';

import type { useProjectDetail } from '../../hooks/use-project-detail';
import { getLatestDeploymentRun } from '../../utils/project-health';
import { LatestDeploymentHero } from '../latest-deployment-hero';
import { ApplicationsPanel } from '../applications-panel';
import { EnvironmentPanel } from '../environment-panel';

type DetailHook = ReturnType<typeof useProjectDetail>;

interface OverviewTabProps {
  detail: DetailHook;
  /** 点击英雄卡内「部署/查看日志」的回调（切到部署 tab）。 */
  onDeployClick?: () => void;
}

export function OverviewTab({ detail, onDeployClick }: OverviewTabProps) {
  const latestRun = getLatestDeploymentRun(detail.deploymentRuns);
  return (
    <div className="space-y-4">
      <LatestDeploymentHero run={latestRun} onDeployClick={onDeployClick} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ApplicationsPanel detail={detail} />
        <EnvironmentPanel detail={detail} />
      </div>
    </div>
  );
}
