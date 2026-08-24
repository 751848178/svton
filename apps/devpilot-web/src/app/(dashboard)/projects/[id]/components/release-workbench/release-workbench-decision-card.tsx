/**
 * 发布单一行预警条：图标 + 单行摘要 + 计数 + 修复入口。
 *
 * 置于页面标题正下方（ReleaseWorkbenchHeader 的 alert 插槽）。
 * ready 态为中性提示，blocked/error 为警告；构建/发布等执行动作
 * 由步骤条与右侧轮次信息卡承载，预警条只回答「当前能否继续、卡在哪」。
 *
 * PX-34：blocked 不再用黄底 + 红徽章叠加，改为中性底 + 左侧红色状态条；
 * 计数文案保留红色以示阻断。
 */
'use client';

import { ArrowRight, Info, WarningCircle } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button, LinkButton } from '@/components/ui';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseOrderStep } from '../../types/release-order.types';
import { releaseOrderStepLabelKey } from '../release-order-stepper.model';
import type { ReleaseWorkbenchGateSummary } from './release-workbench-summary.model';

interface Props {
  decisionStep: ReleaseOrderStep;
  gate: ReleaseWorkbenchGateSummary;
  targetRepairHref?: string;
  onReviewGate: () => void;
}

export function ReleaseWorkbenchDecisionCard(props: Props) {
  const t = useTranslations('projects');
  const blocked = props.gate.state === 'blocked' || props.gate.state === 'error';
  const hasCounts =
    props.gate.blockerCount > 0 || props.gate.warningCount > 0 || props.gate.manualCount > 0;

  return (
    <section
      data-release-decision
      role={blocked ? 'alert' : 'status'}
      aria-labelledby="release-decision-heading"
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm ${
        blocked
          ? 'border-border border-l-4 border-l-destructive bg-muted/40'
          : 'border-border bg-muted/40'
      }`}
    >
      {blocked ? (
        <WarningCircle
          size={17}
          weight="fill"
          aria-hidden="true"
          className="shrink-0 text-destructive"
        />
      ) : (
        <Info
          size={17}
          weight="fill"
          aria-hidden="true"
          className="shrink-0 text-muted-foreground"
        />
      )}
      <span
        id="release-decision-heading"
        data-testid="release-decision-heading"
        className="min-w-0 flex-1 truncate"
      >
        {t('releaseWorkbenchDecisionFor', {
          step: t(releaseOrderStepLabelKey(props.decisionStep)),
        })}
        {' · '}
        <FlowStatusTag
          status={decisionTone(props.gate.state)}
          label={t(`releaseWorkbenchGateState.${props.gate.state}`)}
        />
        {hasCounts
          ? ` · ${t('releaseWorkbenchGateCounts', {
              blocked: props.gate.blockerCount,
              warning: props.gate.warningCount,
              manual: props.gate.manualCount,
            })}`
          : ''}
      </span>
      {blocked ? (
        props.targetRepairHref ? (
          <LinkButton
            href={props.targetRepairHref}
            size="sm"
            variant="outline"
            data-testid="primary-release-action"
          >
            {t('releaseWorkbenchOpenTargetSettings')}
            <ArrowRight
              size={15}
              aria-hidden="true"
            />
          </LinkButton>
        ) : (
          /* PX-19：主 CTA 用带边框 secondary，不再是无按钮感的透明文本。 */
          <Button
            size="sm"
            variant="outline"
            data-testid="primary-release-action"
            onClick={props.onReviewGate}
          >
            {t('releaseWorkbenchReviewGateDetails')}
          </Button>
        )
      ) : null}
    </section>
  );
}

function decisionTone(state: ReleaseWorkbenchGateSummary['state']) {
  if (state === 'ready') return 'succeeded' as const;
  if (state === 'loading') return 'running' as const;
  return 'failed' as const;
}
