/**
 * 失败阶段重试确认。
 *
 * 单一职责：在创建新尝试前明确重试目标、审批复用规则与真实执行后果。
 */
'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface ReleaseRetryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  nextAttemptNo: number;
  onConfirm: () => void | Promise<void>;
}

export function ReleaseRetryDialog({
  open,
  onOpenChange,
  stageName,
  nextAttemptNo,
  onConfirm,
}: ReleaseRetryDialogProps): JSX.Element {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="warning"
      title="确认重试失败阶段"
      description={`将为“${stageName}”创建第 ${nextAttemptNo} 次尝试，并重新进入发布队列。`}
      consequences={[
        '可能再次修改目标环境或触发真实部署',
        '排队或执行期间不能重复重试',
        '只有输入指纹一致且未过期的审批才会复用',
      ]}
      confirmLabel="确认重试"
      onConfirm={onConfirm}
    />
  );
}
