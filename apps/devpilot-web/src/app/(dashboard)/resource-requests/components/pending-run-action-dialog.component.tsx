/**
 * 待执行供给运行动作的确认弹窗
 *
 * 单一职责：把页面底部那段按 pendingRunAction.kind 选择 title/description 的
 * ConfirmDialog 抽出，避免 page.tsx 膨胀。文案统一走 resourceRequests 命名空间。
 */
'use client';

import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { PendingProvisioningAction } from '../hooks/use-provisioning-run-actions';

interface PendingRunActionDialogProps {
  action: PendingProvisioningAction | null;
  /** 当前打开的运行记录目标，用于在描述里引用申请标题。 */
  requestTitle: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function PendingRunActionDialog({
  action,
  requestTitle,
  onOpenChange,
  onConfirm,
}: PendingRunActionDialogProps) {
  const t = useTranslations('resourceRequests');
  const tc = useTranslations('common');

  const title = action
    ? action.kind === 'reconcile'
      ? t('reconcileConfirmTitle')
      : action.kind === 'recoverStale'
        ? t('recoverStaleConfirmTitle')
        : action.kind === 'processNext'
          ? t('processNextConfirmTitle')
          : t('replayConfirmTitle')
    : '';

  const description = action
    ? action.kind === 'reconcile'
      ? t('reconcileConfirmDescription', { title: requestTitle })
      : action.kind === 'recoverStale'
        ? t('recoverStaleConfirmDescription')
        : action.kind === 'processNext'
          ? t('processNextConfirmDescription')
          : t('replayConfirmDescription', { title: requestTitle })
    : undefined;

  return (
    <ConfirmDialog
      open={Boolean(action)}
      onOpenChange={onOpenChange}
      tone="warning"
      title={title}
      description={description}
      confirmLabel={tc('confirm')}
      cancelLabel={tc('cancel')}
      onConfirm={onConfirm}
    />
  );
}
