/**
 * 取消发布确认弹窗（F383, invest-3 §E.5）
 *
 * 单一职责：取消前展示真实后果（终止真实任务、撤销审批、不回滚已执行），
 * 使用 ConfirmDialog tone="danger" + 资源名校验（plan.name）。
 */
'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface ReleaseCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  onConfirm: () => void | Promise<void>;
}

export function ReleaseCancelDialog({
  open,
  onOpenChange,
  planName,
  onConfirm,
}: ReleaseCancelDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      title="取消发布"
      description="取消会立即中止该发布计划。这是逃生通道，不会回滚已执行的阶段。"
      consequences={[
        '所有 queued/running 阶段将被终止',
        '已提交审批会被 cancel',
        '关联 DeploymentRun/ServerExecutionJob 不会被回滚',
      ]}
      resourceName={planName}
      confirmLabel="确认取消发布"
      onConfirm={onConfirm}
    />
  );
}
