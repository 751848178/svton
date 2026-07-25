/**
 * 驳回理由弹窗
 *
 * 单一职责：收集审批人驳回理由（必填），提交时回调 onConfirm(comment)。
 * reject 必须留痕，故 textarea 为空时禁用提交按钮。approved 的可选理由也复用此组件。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Modal, Textarea } from '@svton/ui';

interface RejectReasonModalProps {
  open: boolean;
  /** 弹窗用途：rejected 显示「驳回理由」标题，approved 显示可选理由。 */
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
  const canSubmit = isReject ? trimmed.length > 0 : true;

  const handleConfirm = usePersistFn(() => {
    if (!canSubmit) return;
    onConfirm(trimmed);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isReject ? t('rejectReasonLabel') : t('approveReasonLabel')}
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
        <span className="mb-1 block font-medium">{t('rejectReasonLabel')}</span>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('rejectReasonPlaceholder')}
          invalid={isReject && comment.length > 0 && trimmed.length === 0}
          autoFocus
        />
        {isReject ? (
          <span className="mt-1 block text-xs text-muted-foreground">{t('rejectReasonRequired')}</span>
        ) : null}
      </label>
    </Modal>
  );
}
