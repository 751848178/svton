/**
 * 步骤 01 内联面板 · 前置检查（当前状态，无轮次概念）：
 * 仓库与环境基线事实 + 发布准入门禁目录。
 */
'use client';

import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { FlowStatusTag } from './release-flow-status-tag';
import type { useReleaseGateCatalog } from '../../hooks/use-release-gate-catalog';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { ReleaseGateCatalogView } from '../release-gate-catalog-panel';
import { releaseOrderStepLabelKey } from '../release-order-stepper.model';
import {
  releaseWorkbenchDecisionStep,
  releaseWorkbenchGateStage,
} from './release-workbench-summary.model';

interface Props {
  detail: ReleaseOrderDetail;
  gateCatalog: ReturnType<typeof useReleaseGateCatalog>;
}

export function ReleaseStepPreflightPanel(props: Props) {
  const t = useTranslations('projects');
  const { repository, staging, production } = props.detail.preflight;
  // PX-1：步骤 01 证据区计数与预警条同源（当前执行阶段决策）。
  const decisionStep = releaseWorkbenchDecisionStep(props.detail);

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-3">
        <Baseline
          label={t('releasePreflightRepository')}
          value={repository.branch || t('releasePreflightBranchMissing')}
          ready={repository.ready}
        />
        <Baseline
          label={t('releasePreflightStaging')}
          value={t('releasePreflightBaselineDescription')}
          ready={staging.ready}
        />
        <Baseline
          label={t('releasePreflightProduction')}
          value={t('releasePreflightBaselineDescription')}
          ready={production.ready}
        />
      </dl>
      {props.gateCatalog.loading && !props.gateCatalog.catalog ? (
        <LoadingState text={t('loading')} />
      ) : (
        <ReleaseGateCatalogView
          controller={props.gateCatalog}
          stage={releaseWorkbenchGateStage(decisionStep)}
          stageLabel={t(releaseOrderStepLabelKey(decisionStep))}
        />
      )}
    </div>
  );
}

function Baseline(props: { label: string; value: string; ready: boolean }) {
  const t = useTranslations('projects');
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      {/* PX-24：徽章不折行，描述 truncate。 */}
      <dd className="mt-1 flex min-w-0 items-center gap-2">
        <FlowStatusTag
          className="shrink-0 whitespace-nowrap"
          status={props.ready ? 'success' : 'warning'}
          label={t(props.ready ? 'releasePreflightReady' : 'releasePreflightBlocked')}
        />
        <span
          className="min-w-0 truncate text-xs text-muted-foreground"
          title={props.value}
        >
          {props.value}
        </span>
      </dd>
    </div>
  );
}
