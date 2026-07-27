/**
 * 概览 Tab
 *
 * 单一职责：组合「最近部署英雄卡」+「关联应用」+「环境」三块，
 * 给出页面的第一焦点（最近部署结果如何）与两份精简摘要，
 * 并按用户心智分成两段小节：① 状态快照 ② 运行资源。
 *
 * 全量部署历史、Webhook、资源、设置分别放在各自的 Tab，
 * 概览只承担"项目当前状态快照"。
 *
 * 复用既有 ApplicationsPanel / EnvironmentPanel（已是摘要粒度的列表），
 * 不重复实现其内部，仅做布局编排。
 */

'use client';

import { useTranslations } from 'next-intl';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { getLatestDeploymentRun } from '../../utils/project-health';
import { LatestDeploymentHero } from '../latest-deployment-hero';
import { ApplicationsPanel } from '../applications-panel';
import { EnvironmentPanel } from '../environment-panel';
import { ProjectDeliveryGuide } from '../project-delivery-guide.component';
import type { DeliveryAction } from '../../utils/project-delivery-readiness.utils';

type DetailHook = ReturnType<typeof useProjectDetail>;

interface OverviewTabProps {
  detail: DetailHook;
  /** 点击英雄卡内「部署/查看部署记录」的回调（切到部署 tab）。 */
  onDeployClick?: () => void;
  onDeliveryAction: (action: DeliveryAction, environmentId?: string) => void;
}

export function OverviewTab({ detail, onDeployClick, onDeliveryAction }: OverviewTabProps) {
  const t = useTranslations('projects');
  const latestRun = getLatestDeploymentRun(detail.deploymentRuns);
  return (
    <div className="space-y-6">
      <ProjectDeliveryGuide
        detail={detail}
        onAction={onDeliveryAction}
      />
      {/* ① 状态快照：项目当前最近一次部署的结果如何。 */}
      <OverviewSection
        title={t('overviewStatusSection')}
        description={t('overviewStatusSectionDesc')}
      >
        <LatestDeploymentHero
          run={latestRun}
          onDeployClick={onDeployClick}
        />
      </OverviewSection>
      {/* ② 运行资源：项目下部署了哪些应用、有哪些环境。 */}
      <OverviewSection
        title={t('overviewRuntimeSection')}
        description={t('overviewRuntimeSectionDesc')}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ApplicationsPanel detail={detail} />
          <EnvironmentPanel detail={detail} />
        </div>
      </OverviewSection>
    </div>
  );
}

/** 概览小节标题（统一"标题 + 灰字说明"的分组视觉）。 */
function OverviewSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
