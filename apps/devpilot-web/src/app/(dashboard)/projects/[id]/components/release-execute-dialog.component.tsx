/**
 * 开始执行发布确认弹窗（F383, invest-3 §E.5）
 *
 * 单一职责：执行前展示真实后果（风险摘要 + 副作用 + 目标环境），
 * 使用 ConfirmDialog tone="warning" + 资源名校验（plan.name）。
 */
'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatReleaseSideEffect, RISK_LABEL } from '../utils/release-labels';
import type { ReleasePlanPreview } from '../types/releases';

export interface ReleaseExecuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  environmentName: string;
  preview: ReleasePlanPreview | null;
  onConfirm: () => void | Promise<void>;
}

export function ReleaseExecuteDialog({
  open,
  onOpenChange,
  planName,
  environmentName,
  preview,
  onConfirm,
}: ReleaseExecuteDialogProps): JSX.Element {
  const highRiskCount = preview ? preview.riskSummary.filter((r) => r.risk === 'high').length : 0;
  const mediumRiskCount = preview
    ? preview.riskSummary.filter((r) => r.risk === 'medium').length
    : 0;
  const consequences: string[] = [];
  consequences.push(`目标环境：${environmentName}`);
  if (highRiskCount > 0) consequences.push(`高风险阶段 ${highRiskCount} 个（${RISK_LABEL.high}）`);
  if (mediumRiskCount > 0)
    consequences.push(`中风险阶段 ${mediumRiskCount} 个（${RISK_LABEL.medium}）`);
  if (preview && preview.approvalRequired.length > 0) {
    consequences.push(`需审批阶段 ${preview.approvalRequired.length} 个`);
  }
  if (preview && preview.sideEffects.length > 0) {
    consequences.push(
      ...preview.sideEffects.map((effect) => `执行影响：${formatReleaseSideEffect(effect)}`),
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="warning"
      title="开始执行发布"
      description="执行将按依赖顺序自动推进阶段，部分阶段会真实写入目标环境。"
      consequences={consequences}
      resourceName={planName}
      confirmLabel="确认执行"
      onConfirm={onConfirm}
    />
  );
}
