/**
 * 审批决定意见弹窗
 *
 * 单一职责：为批准和拒绝收集必填意见，提交时回调 onConfirm(comment)。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Modal, Textarea } from '@svton/ui';

interface RejectReasonModalProps {
  open: boolean;
  /** 弹窗用途：决定标题和提交按钮文案。 */
  variant?: 'rejected' | 'approved';
  onClose: () => void;
  onConfirm: (comment: string) => void;
  /** 提交中（actingId 命中时）禁用按钮。 */
  submitting?: boolean;
}

export function RejectReasonModal({
  open,
  variant = 'rejected',
  onClose,
  onConfirm,
  submitting = false,
}: RejectReasonModalProps) {
  const t = useTranslations('operationApprovals');
  const tc = useTranslations('common');
  const [comment, setComment] = useState('');

  // 每次打开重置输入，避免上一次残留。
  useEffect(() => {
    if (open) setComment('');
  }, [open]);

  const trimmed = comment.trim();
  const isReject = variant === 'rejected';
  const canSubmit = trimmed.length > 0;
  const reasonLabel = isReject ? t('rejectReasonLabel') : t('approveReasonLabel');
  const reasonHint = isReject ? t('rejectReasonRequired') : t('approveReasonRequired');

  const handleConfirm = usePersistFn(() => {
    if (!canSubmit) return;
    onConfirm(trimmed);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={reasonLabel}
      width={520}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? t('processing') : isReject ? t('reject') : t('approve')}
          </button>
        </div>
      }
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{reasonLabel}</span>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={isReject ? t('rejectReasonPlaceholder') : t('approveReasonPlaceholder')}
          invalid={comment.length > 0 && trimmed.length === 0}
          autoFocus
        />
        <span className="mt-1 block text-xs text-muted-foreground">{reasonHint}</span>
      </label>
    </Modal>
  );
}
