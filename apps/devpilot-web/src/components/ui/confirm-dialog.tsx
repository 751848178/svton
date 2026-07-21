'use client';

/**
 * 二次确认弹窗
 *
 * 基于 @/components/ui/modal 的分级确认组件：
 * - 基础模式：标题 + 描述 + 后果列表，确认即执行；
 * - L3 模式（传入 resourceName）：必须输入完整资源名称才解禁确认按钮。
 *
 * onConfirm 返回 Promise 时按钮进入 loading 并防重复提交；
 * 失败（reject）不关弹窗，成功（resolve / 同步返回）后自动关闭。
 *
 * 组件纯受控：所有文案由调用方传入（调用方负责 i18n），
 * 默认按钮文案为 确认 / 取消，可用 confirmLabel / cancelLabel 覆盖。
 */

import { useEffect, useState } from 'react';
import { Button, cn } from '@svton/ui';
import { Modal } from './modal';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone?: 'danger' | 'warning';
  title: string;
  description?: string;
  /** 逐条后果列表。 */
  consequences?: string[];
  /** 传入即启用「输入名称才可确认」（L3）。 */
  resourceName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const {
    open,
    onOpenChange,
    tone = 'danger',
    title,
    description,
    consequences,
    resourceName,
    confirmLabel = '确认',
    cancelLabel = '取消',
    onConfirm,
  } = props;

  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 弹窗关闭后重置输入与提交态，避免下次打开残留
  useEffect(() => {
    if (!open) {
      setInputValue('');
      setSubmitting(false);
    }
  }, [open]);

  const close = () => onOpenChange(false);

  const nameMatched = resourceName === undefined || inputValue.trim() === resourceName;
  const confirmDisabled = submitting || !nameMatched;

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        setSubmitting(true);
        await result;
      }
      // 同步返回或 Promise resolve：关闭弹窗
      close();
    } catch {
      // 失败不关弹窗，由调用方通过 feedback 提示
    } finally {
      setSubmitting(false);
    }
  };

  const toneStyles =
    tone === 'danger'
      ? {
          iconWrap: 'bg-red-500/10 text-red-600',
          confirmClass: '',
          confirmVariant: 'danger' as const,
        }
      : {
          iconWrap: 'bg-orange-500/10 text-orange-600',
          confirmClass: '!bg-orange-600 hover:!bg-orange-700',
          confirmVariant: 'primary' as const,
        };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button
            variant={toneStyles.confirmVariant}
            className={toneStyles.confirmClass || undefined}
            loading={submitting}
            disabled={confirmDisabled}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base',
              toneStyles.iconWrap,
            )}
            aria-hidden="true"
          >
            !
          </span>
          <div className="flex flex-col gap-2 text-sm text-gray-700">
            {description && <p className="leading-6">{description}</p>}
            {consequences && consequences.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 leading-6 text-gray-600">
                {consequences.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {resourceName !== undefined && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600">
              请输入 <span className="font-medium text-gray-900">{resourceName}</span> 以确认操作
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={resourceName}
              autoFocus
              disabled={submitting}
              className={cn(
                'h-9 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900',
                'placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
