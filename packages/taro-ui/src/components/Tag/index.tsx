/**
 * Tag 标签组件
 *
 * 功能特性：
 * - 多种类型（primary、success、warning、danger、default）
 * - 多种样式（fill、outline、light）
 * - 多种尺寸
 * - 可关闭
 */
import React, { ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'default';
export type TagVariant = 'light' | 'fill' | 'outline';
export type TagSize = 'small' | 'medium' | 'large';

export interface TagProps {
  /** 标签类型 */
  type?: TagType;
  /** 样式变体 */
  variant?: TagVariant;
  /** 尺寸 */
  size?: TagSize;
  /** 是否圆角 */
  round?: boolean;
  /** 是否可关闭 */
  closeable?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 点击回调 */
  onClick?: () => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 自定义颜色 */
  color?: string;
  /** 自定义背景色 */
  bgColor?: string;
}

export function Tag(props: TagProps) {
  const {
    type = 'default',
    variant = 'light',
    size = 'medium',
    round = false,
    closeable = false,
    onClose,
    onClick,
    children,
    className = '',
    style,
    color,
    bgColor,
  } = props;

  const handleClose = (e: any) => {
    e.stopPropagation();
    onClose?.();
  };

  const tagClass = [
    'svton-tag',
    `svton-tag--${type}`,
    `svton-tag--${variant}`,
    size !== 'medium' ? `svton-tag--${size}` : '',
    round ? 'svton-tag--round' : '',
    className,
  ].filter(Boolean).join(' ');

  const customStyle: CSSProperties = {
    ...style,
    ...(color ? { color } : {}),
    ...(bgColor ? { backgroundColor: bgColor } : {}),
  };

  return (
    <View className={tagClass} style={customStyle} onClick={onClick}>
      <Text>{children}</Text>
      {closeable && (
        <Text className="svton-tag__close" onClick={handleClose}>×</Text>
      )}
    </View>
  );
}

export default Tag;
