/**
 * Cell 单元格组件
 *
 * 功能特性：
 * - 标题、描述、值
 * - 左侧图标
 * - 右侧箭头
 * - 必填标记
 * - 单元格组
 */
import React, { ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export interface CellProps {
  /** 标题 */
  title?: ReactNode;
  /** 描述信息 */
  label?: ReactNode;
  /** 右侧内容 */
  value?: ReactNode;
  /** 左侧图标 */
  icon?: ReactNode;
  /** 是否显示箭头 */
  arrow?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 是否可点击 */
  clickable?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 子元素（自定义右侧内容） */
  children?: ReactNode;
}

export function Cell(props: CellProps) {
  const {
    title,
    label,
    value,
    icon,
    arrow = false,
    required = false,
    clickable,
    disabled = false,
    onClick,
    className = '',
    style,
    children,
  } = props;

  const isClickable = clickable ?? (!!onClick || arrow);

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
  };

  const cellClass = [
    'svton-cell',
    disabled ? 'svton-cell--disabled' : '',
    !isClickable ? 'svton-cell--clickable-false' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={cellClass} style={style} onClick={handleClick}>
      {icon && <View className="svton-cell__icon">{icon}</View>}

      <View className="svton-cell__content">
        {title && (
          <View className="svton-cell__title">
            {required && <Text className="svton-cell__required">*</Text>}
            {title}
          </View>
        )}
        {label && <View className="svton-cell__label">{label}</View>}
      </View>

      {(value || children) && (
        <View className="svton-cell__value">{children || value}</View>
      )}

      {arrow && <Text className="svton-cell__arrow">›</Text>}
    </View>
  );
}

// 单元格组
export interface CellGroupProps {
  /** 分组标题 */
  title?: string;
  /** 是否显示边框 */
  border?: boolean;
  /** 是否为内嵌模式 */
  inset?: boolean;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function CellGroup(props: CellGroupProps) {
  const {
    title,
    border = true,
    inset = false,
    children,
    className = '',
    style,
  } = props;

  const groupClass = [
    'svton-cell-group',
    border ? 'svton-cell-group--border' : '',
    inset ? 'svton-cell-group--inset' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <>
      {title && <View className="svton-cell-group__title">{title}</View>}
      <View className={groupClass} style={style}>
        {children}
      </View>
    </>
  );
}

export default Cell;
