/**
 * NoticeBar 通告栏组件
 *
 * 功能特性：
 * - 多种类型（info、success、warning、error）
 * - 滚动播放
 * - 可关闭
 * - 自定义图标和操作
 */
import React, { useState, useRef, useEffect, CSSProperties, ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export type NoticeBarType = 'info' | 'success' | 'warning' | 'error';

export interface NoticeBarProps {
  /** 通告内容 */
  content: string;
  /** 类型 */
  type?: NoticeBarType;
  /** 是否可关闭 */
  closeable?: boolean;
  /** 是否可点击 */
  clickable?: boolean;
  /** 是否开启滚动 */
  scrollable?: boolean;
  /** 滚动速度（px/s） */
  speed?: number;
  /** 延迟开始滚动时间（ms） */
  delay?: number;
  /** 左侧图标 */
  icon?: ReactNode;
  /** 右侧操作区 */
  action?: ReactNode;
  /** 是否显示链接箭头 */
  link?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

// 默认图标
const ICONS: Record<NoticeBarType, string> = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠️',
  error: '✕',
};

export function NoticeBar(props: NoticeBarProps) {
  const {
    content,
    type = 'warning',
    closeable = false,
    clickable = false,
    scrollable = false,
    speed = 60,
    delay = 1000,
    icon,
    action,
    link = false,
    onClick,
    onClose,
    className = '',
    style,
  } = props;

  const [visible, setVisible] = useState(true);
  const [animationDuration, setAnimationDuration] = useState(0);
  const contentRef = useRef<any>(null);

  // 计算滚动动画时长
  useEffect(() => {
    if (scrollable && content) {
      // 简单估算：每个字符约 14px
      const textWidth = content.length * 14;
      const duration = textWidth / speed;
      
      const timer = setTimeout(() => {
        setAnimationDuration(duration);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [scrollable, content, speed, delay]);

  const handleClose = (e: any) => {
    e.stopPropagation();
    setVisible(false);
    onClose?.();
  };

  const handleClick = () => {
    if (clickable || link) {
      onClick?.();
    }
  };

  if (!visible) return null;

  const noticeBarClass = [
    'svton-notice-bar',
    `svton-notice-bar--${type}`,
    closeable ? 'svton-notice-bar--closeable' : '',
    (clickable || link) ? 'svton-notice-bar--clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  const textStyle: CSSProperties = scrollable && animationDuration > 0
    ? { animationDuration: `${animationDuration}s` }
    : {};

  return (
    <View className={noticeBarClass} style={style} onClick={handleClick}>
      {icon !== null && (
        <View className="svton-notice-bar__icon">
          {icon !== undefined ? icon : ICONS[type]}
        </View>
      )}

      <View className="svton-notice-bar__content">
        <View className="svton-notice-bar__wrap">
          <Text
            ref={contentRef}
            className={`svton-notice-bar__text ${scrollable && animationDuration > 0 ? 'svton-notice-bar__text--scrollable' : ''}`}
            style={textStyle}
          >
            {content}
          </Text>
        </View>
      </View>

      {action && <View className="svton-notice-bar__action">{action}</View>}

      {link && <Text className="svton-notice-bar__arrow">›</Text>}

      {closeable && (
        <View className="svton-notice-bar__close" onClick={handleClose}>
          <Text>×</Text>
        </View>
      )}
    </View>
  );
}

export default NoticeBar;
