/**
 * Switch 开关组件
 *
 * 功能特性：
 * - 开关切换
 * - 加载状态
 * - 禁用状态
 * - 多种尺寸
 */
import React, { CSSProperties } from 'react';
import { View } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export type SwitchSize = 'small' | 'medium' | 'large';

export interface SwitchProps {
  /** 是否选中 */
  checked?: boolean;
  /** 默认是否选中 */
  defaultChecked?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 尺寸 */
  size?: SwitchSize;
  /** 选中时的颜色 */
  activeColor?: string;
  /** 未选中时的颜色 */
  inactiveColor?: string;
  /** 变化回调 */
  onChange?: (checked: boolean) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Switch(props: SwitchProps) {
  const {
    checked,
    defaultChecked = false,
    disabled = false,
    loading = false,
    size = 'medium',
    activeColor,
    inactiveColor,
    onChange,
    className = '',
    style,
  } = props;

  // 受控/非受控
  const [innerChecked, setInnerChecked] = React.useState(defaultChecked);
  const isChecked = checked !== undefined ? checked : innerChecked;

  const handleClick = usePersistFn(() => {
    if (disabled || loading) return;

    const newChecked = !isChecked;
    if (checked === undefined) {
      setInnerChecked(newChecked);
    }
    onChange?.(newChecked);
  });

  const switchClass = [
    'svton-switch',
    isChecked ? 'svton-switch--checked' : '',
    disabled ? 'svton-switch--disabled' : '',
    loading ? 'svton-switch--loading' : '',
    size !== 'medium' ? `svton-switch--${size}` : '',
    className,
  ].filter(Boolean).join(' ');

  const trackStyle: CSSProperties = {};
  if (isChecked && activeColor) {
    trackStyle.backgroundColor = activeColor;
  } else if (!isChecked && inactiveColor) {
    trackStyle.backgroundColor = inactiveColor;
  }

  return (
    <View className={switchClass} style={style} onClick={handleClick}>
      <View className="svton-switch__track" style={trackStyle}>
        <View className="svton-switch__thumb">
          {loading && <View className="svton-switch__loading" />}
        </View>
      </View>
    </View>
  );
}

export default Switch;
