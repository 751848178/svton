/**
 * Toast 轻提示组件
 *
 * 功能特性：
 * - 多种类型（success、error、warning、loading、text）
 * - 自定义图标
 * - 自定义位置
 * - 自动关闭
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export type ToastType = 'success' | 'error' | 'warning' | 'loading' | 'text';
export type ToastPosition = 'top' | 'center' | 'bottom';

export interface ToastProps {
  /** 是否显示 */
  visible: boolean;
  /** 提示类型 */
  type?: ToastType;
  /** 提示内容 */
  message: string;
  /** 显示位置 */
  position?: ToastPosition;
  /** 显示时长（ms），0 表示不自动关闭 */
  duration?: number;
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 关闭回调 */
  onClose?: () => void;
  /** 层级 */
  zIndex?: number;
}

// 图标映射
const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  loading: '◌',
};

export function Toast(props: ToastProps) {
  const {
    visible,
    type = 'text',
    message,
    position = 'center',
    duration = 2000,
    icon,
    onClose,
    zIndex = 2000,
  } = props;

  const [innerVisible, setInnerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setInnerVisible(true);

      if (duration > 0 && type !== 'loading') {
        const timer = setTimeout(() => {
          onClose?.();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      // 延迟隐藏，等待动画
      const timer = setTimeout(() => {
        setInnerVisible(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, type, onClose]);

  if (!innerVisible) return null;

  const showIcon = type !== 'text';
  const iconContent = icon || (showIcon ? ICONS[type] : null);

  return (
    <View
      className={`svton-toast ${!showIcon ? 'svton-toast--text-only' : ''}`}
      style={{ zIndex }}
    >
      <View
        className={`svton-toast__content svton-toast__content--${position} ${visible ? 'svton-toast__content--visible' : 'svton-toast__content--hidden'}`}
      >
        {iconContent && (
          <Text className={`svton-toast__icon svton-toast__icon--${type}`}>
            {iconContent}
          </Text>
        )}
        <Text className="svton-toast__text">{message}</Text>
      </View>
    </View>
  );
}

// Toast 管理器类型
export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
}

export default Toast;
