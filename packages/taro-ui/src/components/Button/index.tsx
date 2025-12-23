/**
 * Button 组件 - 通用按钮组件
 *
 * 功能特性：
 * - 多种类型（primary、default、danger、text）
 * - 多种尺寸（large、medium、small）
 * - 加载状态
 * - 禁用状态
 * - 块级按钮
 * - 自定义样式
 */
import React, { CSSProperties, ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export type ButtonType = 'primary' | 'default' | 'danger' | 'text';
export type ButtonSize = 'large' | 'medium' | 'small';

export interface ButtonProps {
  /** 按钮类型 */
  type?: ButtonType;
  /** 按钮尺寸 */
  size?: ButtonSize;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否为块级按钮（宽度100%） */
  block?: boolean;
  /** 按钮文本 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 点击事件 */
  onClick?: () => void;
}

export function Button(props: ButtonProps) {
  const {
    type = 'default',
    size = 'medium',
    loading = false,
    disabled = false,
    block = false,
    children,
    className = '',
    style,
    onClick,
  } = props;

  const handleClick = usePersistFn(() => {
    if (disabled || loading) return;
    onClick?.();
  });

  return (
    <View
      className={`svton-button svton-button--${type} svton-button--${size} ${
        block ? 'svton-button--block' : ''
      } ${disabled ? 'svton-button--disabled' : ''} ${
        loading ? 'svton-button--loading' : ''
      } ${className}`}
      style={style}
      onClick={handleClick}
    >
      {loading && (
        <View className="svton-button__loading">
          <Text className="svton-button__loading-icon">⏳</Text>
        </View>
      )}
      <Text className="svton-button__text">{children}</Text>
    </View>
  );
}

export default Button;
