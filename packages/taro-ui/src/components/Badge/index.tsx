/**
 * Badge 徽标组件
 *
 * 功能特性：
 * - 数字徽标
 * - 红点徽标
 * - 自定义内容
 * - 最大值限制
 */
import React, { ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export type BadgeType = 'danger' | 'primary' | 'success' | 'warning';

export interface BadgeProps {
  /** 徽标内容 */
  content?: ReactNode;
  /** 是否显示为红点 */
  dot?: boolean;
  /** 最大值，超过显示 max+ */
  max?: number;
  /** 是否显示 0 */
  showZero?: boolean;
  /** 徽标类型 */
  type?: BadgeType;
  /** 偏移量 [x, y] */
  offset?: [number, number];
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Badge(props: BadgeProps) {
  const {
    content,
    dot = false,
    max = 99,
    showZero = false,
    type = 'danger',
    offset,
    children,
    className = '',
    style,
  } = props;

  // 计算显示内容
  const renderContent = () => {
    if (dot) return null;

    if (typeof content === 'number') {
      if (content === 0 && !showZero) return null;
      if (content > max) return `${max}+`;
      return content;
    }

    return content;
  };

  const displayContent = renderContent();
  const hasChildren = !!children;
  const showBadge = dot || displayContent !== null;

  if (!showBadge && !hasChildren) return null;

  // 偏移样式
  const offsetStyle: CSSProperties = offset
    ? { top: `${offset[1]}rpx`, right: `${offset[0]}rpx` }
    : {};

  const badgeClass = [
    'svton-badge',
    `svton-badge--${type}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={badgeClass} style={style}>
      {children}

      {showBadge && (
        dot ? (
          <View
            className={`svton-badge__dot ${!hasChildren ? 'svton-badge__dot--standalone' : ''}`}
            style={offsetStyle}
          />
        ) : (
          <View
            className={`svton-badge__content ${!hasChildren ? 'svton-badge__content--standalone' : ''}`}
            style={offsetStyle}
          >
            <Text>{displayContent}</Text>
          </View>
        )
      )}
    </View>
  );
}

export default Badge;
