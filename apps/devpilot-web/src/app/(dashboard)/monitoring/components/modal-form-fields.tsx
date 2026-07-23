/**
 * 监控域弹窗表单复用原语
 *
 * 单一职责：为 create-rule / create-silence / create-channel 等弹窗提供
 * 统一的「标签 + 控件」包裹与「取消 / 创建」页脚，消除重复样板。
 * 仅样式与结构，无业务逻辑。
 */

'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface FieldLabelProps {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

/** 标签 + 控件包裹（替代各弹窗重复的 label.block.text-sm 样板）。 */
export function FieldLabel({ label, hint, children }: FieldLabelProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

interface ModalFormFooterProps {
  creating: boolean;
  submitting: boolean;
  onClose: () => void;
}

/** 弹窗表单底部「取消 / 创建」按钮组。 */
export function ModalFormFooter({ creating, submitting, onClose }: ModalFormFooterProps) {
  const t = useTranslations('monitoring');
  const tc = useTranslations('common');
  return (
    <div className="flex justify-end gap-2 pt-4">
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-md border px-4 text-sm font-medium hover:bg-accent"
      >
        {tc('cancel')}
      </button>
      <button
        type="submit"
        disabled={creating || submitting}
        className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {creating || submitting ? t('creating') : tc('create')}
      </button>
    </div>
  );
}
