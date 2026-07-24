/**
 * 部署运行状态徽章
 *
 * 单一职责：把 DeploymentRun 的 status + dryRun 渲染为带语义颜色的 StatusTag，
 * 并附带模式标记（dry-run / live）。供向导结果区与服务行内联状态复用。
 *
 * 复用 @/components/ui StatusTag（已封装状态→颜色映射 + progress 呼吸点）。
 */

'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { CreatedDeploymentRun } from '../types';

interface DeployRunStatusBadgeProps {
  run: CreatedDeploymentRun;
}

export function DeployRunStatusBadge({ run }: DeployRunStatusBadgeProps) {
  const t = useTranslations('applications');
  const label = runStatusLabel(t, run.status);
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusTag status={run.status} label={label} />
      <span className="text-xs text-muted-foreground">
        {run.dryRun ? t('modeDryRun') : t('modeLive')}
      </span>
    </span>
  );
}

/** 状态值 → 本地化标签（未知值回退原值）。 */
function runStatusLabel(
  t: ReturnType<typeof useTranslations<'applications'>>,
  status: string,
): string {
  const s = status.toLowerCase();
  if (s === 'queued') return t('runStatusQueued');
  if (s === 'running') return t('runStatusRunning');
  if (s === 'completed') return t('runStatusCompleted');
  if (s === 'failed') return t('runStatusFailed');
  if (s === 'blocked') return t('runStatusBlocked');
  if (s === 'cancelled' || s === 'canceled') return t('runStatusCancelled');
  return status;
}
