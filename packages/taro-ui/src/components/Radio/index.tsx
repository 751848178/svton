/**
 * Radio 单选框组件
 *
 * 功能特性：
 * - 单选组
 * - 自定义图标
 * - 禁用状态
 */
import { useState, createContext, useContext, ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export interface RadioProps {
  /** 是否选中 */
  checked?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 选中时的颜色 */
  checkedColor?: string;
  /** 图标大小 */
  iconSize?: number;
  /** 值 */
  value?: string | number;
  /** 变化回调 */
  onChange?: (checked: boolean) => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

// RadioGroup Context
interface RadioGroupContextValue {
  value: string | number | undefined;
  disabled?: boolean;
  onChange: (val: string | number) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export function Radio(props: RadioProps) {
  const {
    checked,
    disabled = false,
    checkedColor,
    iconSize = 40,
    value,
    onChange,
    children,
    className = '',
    style,
  } = props;

  const groupContext = useContext(RadioGroupContext);

  // 判断是否选中
  const isChecked = groupContext
    ? value !== undefined && groupContext.value === value
    : checked;

  const isDisabled = groupContext?.disabled || disabled;

  const handleClick = usePersistFn(() => {
    if (isDisabled || isChecked) return;

    if (groupContext && value !== undefined) {
      groupContext.onChange(value);
    } else {
      onChange?.(true);
    }
  });

  const radioClass = [
    'svton-radio',
    isChecked ? 'svton-radio--checked' : '',
    isDisabled ? 'svton-radio--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  const iconStyle: CSSProperties = {
    width: `${iconSize}rpx`,
    height: `${iconSize}rpx`,
    ...(isChecked && checkedColor ? { borderColor: checkedColor } : {}),
  };

  const dotStyle: CSSProperties = {
    width: `${iconSize * 0.5}rpx`,
    height: `${iconSize * 0.5}rpx`,
    ...(isChecked && checkedColor ? { backgroundColor: checkedColor } : {}),
  };

  return (
    <View className={radioClass} style={style} onClick={handleClick}>
      <View className="svton-radio__icon" style={iconStyle}>
        {isChecked && <View className="svton-radio__dot" style={dotStyle} />}
      </View>
      {children && <View className="svton-radio__label">{children}</View>}
    </View>
  );
}

// RadioGroup
export interface RadioGroupProps {
  /** 选中的值 */
  value?: string | number;
  /** 默认选中的值 */
  defaultValue?: string | number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 排列方向 */
  direction?: 'horizontal' | 'vertical';
  /** 变化回调 */
  onChange?: (value: string | number) => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function RadioGroup(props: RadioGroupProps) {
  const {
    value,
    defaultValue,
    disabled = false,
    direction = 'vertical',
    onChange,
    children,
    className = '',
    style,
  } = props;

  const [innerValue, setInnerValue] = useState<string | number | undefined>(defaultValue);
  const currentValue = value !== undefined ? value : innerValue;

  const handleChange = usePersistFn((val: string | number) => {
    if (value === undefined) {
      setInnerValue(val);
    }
    onChange?.(val);
  });

  const groupClass = [
    'svton-radio-group',
    `svton-radio-group--${direction}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <RadioGroupContext.Provider value={{ value: currentValue, disabled, onChange: handleChange }}>
      <View className={groupClass} style={style}>
        {children}
      </View>
    </RadioGroupContext.Provider>
  );
}

export default Radio;
