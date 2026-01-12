/**
 * Checkbox 复选框组件
 *
 * 功能特性：
 * - 单独使用或组合使用
 * - 自定义图标
 * - 禁用状态
 */
import { useState, createContext, useContext, ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export type CheckboxShape = 'square' | 'round';

export interface CheckboxProps {
  /** 是否选中 */
  checked?: boolean;
  /** 默认是否选中 */
  defaultChecked?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 形状 */
  shape?: CheckboxShape;
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

// CheckboxGroup Context
interface CheckboxGroupContextValue {
  value: (string | number)[];
  disabled?: boolean;
  onChange: (val: string | number, checked: boolean) => void;
}

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

export function Checkbox(props: CheckboxProps) {
  const {
    checked,
    defaultChecked = false,
    disabled = false,
    shape = 'round',
    checkedColor,
    iconSize = 40,
    value,
    onChange,
    children,
    className = '',
    style,
  } = props;

  const groupContext = useContext(CheckboxGroupContext);

  // 受控/非受控
  const [innerChecked, setInnerChecked] = useState(defaultChecked);

  // 判断是否选中
  const isChecked = groupContext
    ? value !== undefined && groupContext.value.includes(value)
    : (checked !== undefined ? checked : innerChecked);

  const isDisabled = groupContext?.disabled || disabled;

  const handleClick = usePersistFn(() => {
    if (isDisabled) return;

    const newChecked = !isChecked;

    if (groupContext && value !== undefined) {
      groupContext.onChange(value, newChecked);
    } else {
      if (checked === undefined) {
        setInnerChecked(newChecked);
      }
      onChange?.(newChecked);
    }
  });

  const checkboxClass = [
    'svton-checkbox',
    isChecked ? 'svton-checkbox--checked' : '',
    isDisabled ? 'svton-checkbox--disabled' : '',
    `svton-checkbox--${shape}`,
    className,
  ].filter(Boolean).join(' ');

  const iconStyle: CSSProperties = {
    width: `${iconSize}rpx`,
    height: `${iconSize}rpx`,
    fontSize: `${iconSize * 0.7}rpx`,
    ...(isChecked && checkedColor ? { backgroundColor: checkedColor, borderColor: checkedColor } : {}),
  };

  return (
    <View className={checkboxClass} style={style} onClick={handleClick}>
      <View className="svton-checkbox__icon" style={iconStyle}>
        {isChecked && <Text className="svton-checkbox__check">✓</Text>}
      </View>
      {children && <View className="svton-checkbox__label">{children}</View>}
    </View>
  );
}

// CheckboxGroup
export interface CheckboxGroupProps {
  /** 选中的值 */
  value?: (string | number)[];
  /** 默认选中的值 */
  defaultValue?: (string | number)[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 排列方向 */
  direction?: 'horizontal' | 'vertical';
  /** 变化回调 */
  onChange?: (value: (string | number)[]) => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function CheckboxGroup(props: CheckboxGroupProps) {
  const {
    value,
    defaultValue = [],
    disabled = false,
    direction = 'vertical',
    onChange,
    children,
    className = '',
    style,
  } = props;

  const [innerValue, setInnerValue] = useState<(string | number)[]>(defaultValue);
  const currentValue = value !== undefined ? value : innerValue;

  const handleChange = usePersistFn((val: string | number, checked: boolean) => {
    let newValue: (string | number)[];

    if (checked) {
      newValue = [...currentValue, val];
    } else {
      newValue = currentValue.filter(v => v !== val);
    }

    if (value === undefined) {
      setInnerValue(newValue);
    }
    onChange?.(newValue);
  });

  const groupClass = [
    'svton-checkbox-group',
    `svton-checkbox-group--${direction}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <CheckboxGroupContext.Provider value={{ value: currentValue, disabled, onChange: handleChange }}>
      <View className={groupClass} style={style}>
        {children}
      </View>
    </CheckboxGroupContext.Provider>
  );
}

export default Checkbox;
