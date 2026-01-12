/**
 * Stepper 步进器组件
 *
 * 功能特性：
 * - 数量增减
 * - 最大/最小值限制
 * - 步长设置
 * - 禁用状态
 * - 输入框编辑
 */
import { useState, CSSProperties } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export type StepperSize = 'small' | 'medium' | 'large';

export interface StepperProps {
  /** 当前值 */
  value?: number;
  /** 默认值 */
  defaultValue?: number;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步长 */
  step?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否禁用输入框 */
  disableInput?: boolean;
  /** 尺寸 */
  size?: StepperSize;
  /** 是否显示加减按钮 */
  showButtons?: boolean;
  /** 输入框宽度 */
  inputWidth?: number;
  /** 小数位数 */
  decimalLength?: number;
  /** 是否异步变更 */
  asyncChange?: boolean;
  /** 变化回调 */
  onChange?: (value: number) => void;
  /** 加号点击回调 */
  onPlus?: () => void;
  /** 减号点击回调 */
  onMinus?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Stepper(props: StepperProps) {
  const {
    value,
    defaultValue = 1,
    min = 1,
    max = Infinity,
    step = 1,
    disabled = false,
    disableInput = false,
    size = 'medium',
    showButtons = true,
    inputWidth,
    decimalLength,
    asyncChange = false,
    onChange,
    onPlus,
    onMinus,
    className = '',
    style,
  } = props;

  const [innerValue, setInnerValue] = useState(defaultValue);
  const currentValue = value !== undefined ? value : innerValue;

  // 格式化数值
  const formatValue = (val: number): number => {
    val = Math.max(min, Math.min(max, val));
    if (decimalLength !== undefined) {
      val = parseFloat(val.toFixed(decimalLength));
    }
    return val;
  };

  const updateValue = usePersistFn((newValue: number) => {
    newValue = formatValue(newValue);
    if (!asyncChange && value === undefined) {
      setInnerValue(newValue);
    }
    onChange?.(newValue);
  });

  const handleMinus = usePersistFn(() => {
    if (disabled || currentValue <= min) return;
    onMinus?.();
    updateValue(currentValue - step);
  });

  const handlePlus = usePersistFn(() => {
    if (disabled || currentValue >= max) return;
    onPlus?.();
    updateValue(currentValue + step);
  });

  const handleInput = usePersistFn((e: any) => {
    const val = e.detail.value;
    if (val === '') return;

    const num = parseFloat(val);
    if (!isNaN(num)) {
      updateValue(num);
    }
  });

  const handleBlur = usePersistFn((e: any) => {
    const val = e.detail.value;
    if (val === '' || isNaN(parseFloat(val))) {
      updateValue(min);
    }
  });

  const isMinDisabled = disabled || currentValue <= min;
  const isMaxDisabled = disabled || currentValue >= max;

  const stepperClass = [
    'svton-stepper',
    disabled ? 'svton-stepper--disabled' : '',
    size !== 'medium' ? `svton-stepper--${size}` : '',
    className,
  ].filter(Boolean).join(' ');

  const inputStyle: CSSProperties = inputWidth ? { width: `${inputWidth}rpx` } : {};

  return (
    <View className={stepperClass} style={style}>
      {showButtons && (
        <View
          className={`svton-stepper__btn svton-stepper__minus ${isMinDisabled ? 'svton-stepper__btn--disabled' : ''}`}
          onClick={handleMinus}
        >
          <Text>−</Text>
        </View>
      )}

      <Input
        className="svton-stepper__input"
        style={inputStyle}
        type="digit"
        value={String(currentValue)}
        disabled={disabled || disableInput}
        onInput={handleInput}
        onBlur={handleBlur}
      />

      {showButtons && (
        <View
          className={`svton-stepper__btn svton-stepper__plus ${isMaxDisabled ? 'svton-stepper__btn--disabled' : ''}`}
          onClick={handlePlus}
        >
          <Text>+</Text>
        </View>
      )}
    </View>
  );
}

export default Stepper;
