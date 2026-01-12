/**
 * Divider 分割线组件
 *
 * 功能特性：
 * - 水平/垂直方向
 * - 带文字分割线
 * - 虚线样式
 * - 自定义颜色
 */
import React, { ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export type DividerDirection = 'horizontal' | 'vertical';
export type DividerContentPosition = 'left' | 'center' | 'right';

export interface DividerProps {
  /** 方向 */
  direction?: DividerDirection;
  /** 是否虚线 */
  dashed?: boolean;
  /** 文字位置 */
  contentPosition?: DividerContentPosition;
  /** 分割线颜色 */
  color?: string;
  /** 分割线粗细 */
  borderWidth?: number;
  /** 子元素（文字内容） */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Divider(props: DividerProps) {
  const {
    direction = 'horizontal',
    dashed = false,
    contentPosition = 'center',
    color,
    borderWidth,
    children,
    className = '',
    style,
  } = props;

  const hasContent = !!children;

  const dividerClass = [
    'svton-divider',
    `svton-divider--${direction}`,
    dashed ? 'svton-divider--dashed' : '',
    hasContent ? `svton-divider--content-${contentPosition}` : '',
    className,
  ].filter(Boolean).join(' ');

  const lineStyle: CSSProperties = {
    ...(color ? { borderColor: color } : {}),
    ...(borderWidth ? { borderWidth: `${borderWidth}rpx` } : {}),
  };

  if (direction === 'vertical') {
    return (
      <View
        className={dividerClass}
        style={{
          ...style,
          ...lineStyle,
        }}
      />
    );
  }

  return (
    <View className={dividerClass} style={style}>
      <View className="svton-divider__line svton-divider__line--left" style={lineStyle} />
      {hasContent && (
        <View className="svton-divider__content">
          <Text>{children}</Text>
        </View>
      )}
      <View className="svton-divider__line svton-divider__line--right" style={lineStyle} />
    </View>
  );
}

export default Divider;
