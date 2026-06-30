import React, { ReactNode } from 'react';
import { Modal } from '../Modal';
import { Button, type ButtonProps } from '../Button';

/**
 * Dialog 确认对话框
 *
 * 与 Modal 区分：Modal 是通用容器（自由内容），Dialog 是「确认/取消」二选一的轻量封装。
 * 单一职责：组合标题 + 内容 + 取消/确认按钮，统一交互。
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** 标题 */
  title?: ReactNode;
  /** 正文 */
  children?: ReactNode;
  /** 确认按钮文案（默认「确认」） */
  confirmText?: string;
  /** 取消按钮文案（默认「取消」） */
  cancelText?: string;
  /** 确认回调；返回 Promise 时按钮进入 loading，resolve 后关闭 */
  onConfirm?: () => void | Promise<void>;
  /** 确认按钮 variant（默认 primary；危险操作用 danger） */
  confirmVariant?: ButtonProps['variant'];
  /** 是否隐藏取消按钮 */
  hideCancel?: boolean;
  /** 受控 loading */
  loading?: boolean;
  /** 禁用确认（如未填完必填） */
  confirmDisabled?: boolean;
}

export function Dialog(props: DialogProps) {
  const {
    open,
    onClose,
    title,
    children,
    confirmText = '确认',
    cancelText = '取消',
    onConfirm,
    confirmVariant = 'primary',
    hideCancel = false,
    loading = false,
    confirmDisabled = false,
  } = props;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={420}
      footer={
        <div className="flex justify-end gap-2">
          {hideCancel ? null : (
            <Button
              variant="secondary"
              onClick={onClose}
            >
              {cancelText}
            </Button>
          )}
          <Button
            variant={confirmVariant}
            loading={loading}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
