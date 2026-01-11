/**
 * Popup 弹出层组件
 *
 * 功能特性：
 * - 支持上下左右四个方向弹出
 * - 遮罩层点击关闭
 * - 动画过渡效果
 * - 圆角配置
 * - 安全区域适配
 */
import React, { ReactNode, CSSProperties, useEffect, useState } from 'react';
import { View } from '@tarojs/components';
import './index.scss';

export type PopupPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface PopupProps {
  /** 是否显示 */
  visible: boolean;
  /** 弹出位置 */
  position?: PopupPosition;
  /** 是否显示遮罩 */
  overlay?: boolean;
  /** 点击遮罩是否关闭 */
  closeOnOverlayClick?: boolean;
  /** 是否显示圆角 */
  round?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 打开后回调 */
  onOpen?: () => void;
  /** 关闭后回调 */
  onClosed?: () => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 遮罩自定义样式 */
  overlayStyle?: CSSProperties;
  /** 是否适配底部安全区域 */
  safeAreaInsetBottom?: boolean;
  /** 是否适配顶部安全区域 */
  safeAreaInsetTop?: boolean;
  /** 层级 */
  zIndex?: number;
  /** 是否锁定背景滚动 */
  lockScroll?: boolean;
}

export function Popup(props: PopupProps) {
  const {
    visible,
    position = 'bottom',
    overlay = true,
    closeOnOverlayClick = true,
    round = false,
    onClose,
    onOpen,
    onClosed,
    children,
    className = '',
    style,
    overlayStyle,
    safeAreaInsetBottom = false,
    safeAreaInsetTop = false,
    zIndex = 1000,
    lockScroll = true,
  } = props;

  const [animating, setAnimating] = useState(false);
  const [innerVisible, setInnerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setInnerVisible(true);
      setAnimating(true);
      onOpen?.();
      // 动画结束
      const timer = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(timer);
    } else if (innerVisible) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setInnerVisible(false);
        setAnimating(false);
        onClosed?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose?.();
    }
  };

  const handleContentClick = (e: any) => {
    e.stopPropagation();
  };

  // 阻止滚动穿透
  const handleTouchMove = (e: any) => {
    if (lockScroll) {
      e.stopPropagation();
    }
  };

  if (!innerVisible) return null;

  const popupClass = [
    'svton-popup',
    `svton-popup--${position}`,
    visible ? 'svton-popup--visible' : 'svton-popup--hidden',
    round ? 'svton-popup--round' : '',
    safeAreaInsetBottom ? 'svton-popup--safe-bottom' : '',
    safeAreaInsetTop ? 'svton-popup--safe-top' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View
      className="svton-popup__wrapper"
      style={{ zIndex }}
      onTouchMove={handleTouchMove}
      catchMove={lockScroll}
    >
      {overlay && (
        <View
          className={`svton-popup__overlay ${visible ? 'svton-popup__overlay--visible' : 'svton-popup__overlay--hidden'}`}
          style={overlayStyle}
          onClick={handleOverlayClick}
        />
      )}
      <View
        className={popupClass}
        style={style}
        onClick={handleContentClick}
      >
        {children}
      </View>
    </View>
  );
}

export default Popup;
