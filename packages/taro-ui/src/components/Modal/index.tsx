/**
 * Modal 弹窗组件
 *
 * 功能特性：
 * - 确认框、提示框
 * - 自定义标题和内容
 * - 自定义按钮
 * - 支持异步关闭
 */
import React, { ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import { Popup } from '../Popup';
import './index.scss';

export interface ModalAction {
  /** 按钮文本 */
  text: string;
  /** 按钮类型 */
  type?: 'cancel' | 'confirm' | 'danger';
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击回调 */
  onClick?: () => void | Promise<void>;
}

export interface ModalProps {
  /** 是否显示 */
  visible: boolean;
  /** 标题 */
  title?: ReactNode;
  /** 内容 */
  content?: ReactNode;
  /** 操作按钮 */
  actions?: ModalAction[];
  /** 按钮排列方向 */
  actionsDirection?: 'horizontal' | 'vertical';
  /** 点击遮罩是否关闭 */
  closeOnOverlayClick?: boolean;
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 子元素（自定义内容） */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 层级 */
  zIndex?: number;
}

export function Modal(props: ModalProps) {
  const {
    visible,
    title,
    content,
    actions = [],
    actionsDirection = 'horizontal',
    closeOnOverlayClick = false,
    showClose = false,
    onClose,
    children,
    className = '',
    style,
    zIndex = 1000,
  } = props;

  const handleAction = async (action: ModalAction) => {
    if (action.disabled) return;
    await action.onClick?.();
  };

  const hasTitle = !!title;

  return (
    <Popup
      visible={visible}
      position="center"
      closeOnOverlayClick={closeOnOverlayClick}
      onClose={onClose}
      zIndex={zIndex}
    >
      <View
        className={`svton-modal ${!hasTitle ? 'svton-modal--no-title' : ''} ${className}`}
        style={style}
      >
        {showClose && (
          <View className="svton-modal__close" onClick={onClose}>
            <Text>×</Text>
          </View>
        )}

        {hasTitle && (
          <View className="svton-modal__header">
            <Text className="svton-modal__title">{title}</Text>
          </View>
        )}

        <View className="svton-modal__content">
          {children || content}
        </View>

        {actions.length > 0 && (
          <View
            className={`svton-modal__footer ${actionsDirection === 'vertical' ? 'svton-modal__footer--vertical' : ''}`}
          >
            {actions.map((action, index) => (
              <View
                key={index}
                className={`svton-modal__btn svton-modal__btn--${action.type || 'confirm'} ${action.disabled ? 'svton-modal__btn--disabled' : ''}`}
                onClick={() => handleAction(action)}
              >
                <Text>{action.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Popup>
  );
}

// 便捷方法类型
export interface ModalAlertOptions {
  title?: string;
  content: string;
  confirmText?: string;
  onConfirm?: () => void | Promise<void>;
}

export interface ModalConfirmOptions extends ModalAlertOptions {
  cancelText?: string;
  onCancel?: () => void;
}

export default Modal;
