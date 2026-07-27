/**
 * 跳过可选阶段确认弹窗（F383, invest-3 §E.5）
 *
 * 单一职责：双重确认 —— 自由填写跳过原因（非空）+ L3 逐字输入确认短语。
 * 用户必须亲自输入两段内容；服务端禁止自动提交固定理由。
 * onConfirm 回调接收 {reason, confirmationText} 交由 ops.skipStage。
 */
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui';
import { SKIP_CONFIRMATION_TEXT } from '../utils/release-labels';

export interface ReleaseSkipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  onConfirm: (body: { reason: string; confirmationText: string }) => void | Promise<void>;
}

export function ReleaseSkipDialog({
  open,
  onOpenChange,
  stageName,
  onConfirm,
}: ReleaseSkipDialogProps): JSX.Element {
  const [reason, setReason] = useState('');
  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setPhrase('');
      setSubmitting(false);
    }
  }, [open]);

  const close = () => onOpenChange(false);
  const reasonValid = reason.trim().length > 0;
  const phraseValid = phrase.trim() === SKIP_CONFIRMATION_TEXT;
  const confirmDisabled = submitting || !reasonValid || !phraseValid;

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    try {
      setSubmitting(true);
      const result = onConfirm({
        reason: reason.trim(),
        confirmationText: SKIP_CONFIRMATION_TEXT,
      });
      if (result instanceof Promise) await result;
      close();
    } catch {
      // 失败不关弹窗，由调用方 feedback 提示
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="跳过可选阶段"
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            取消
          </Button>
          <Button variant="primary" loading={submitting} disabled={confirmDisabled} onClick={handleConfirm}>
            确认跳过
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-gray-700">
        <p>
          即将跳过阶段 <span className="font-medium text-gray-900">{stageName}</span>。
          跳过后该阶段不再执行，发布继续推进。
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-gray-600">跳过原因（必填）</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请填写跳过该阶段的原因，便于审计追溯"
            autoFocus
            disabled={submitting}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-gray-600">
            请输入 <span className="font-medium text-gray-900">{SKIP_CONFIRMATION_TEXT}</span> 以确认
          </label>
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={SKIP_CONFIRMATION_TEXT}
            disabled={submitting}
            className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
    </Modal>
  );
}
