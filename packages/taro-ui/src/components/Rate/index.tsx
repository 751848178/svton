/**
 * Rate 评分组件
 *
 * 功能特性：
 * - 自定义星星数量
 * - 半星支持
 * - 自定义图标
 * - 只读/禁用状态
 */
import { useState, CSSProperties, ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export type RateSize = 'small' | 'medium' | 'large';

export interface RateProps {
  /** 当前分数 */
  value?: number;
  /** 默认分数 */
  defaultValue?: number;
  /** 星星总数 */
  count?: number;
  /** 是否允许半星 */
  allowHalf?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸 */
  size?: RateSize;
  /** 选中时的颜色 */
  activeColor?: string;
  /** 未选中时的颜色 */
  inactiveColor?: string;
  /** 自定义图标 */
  icon?: ReactNode;
  /** 自定义空图标 */
  voidIcon?: ReactNode;
  /** 变化回调 */
  onChange?: (value: number) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Rate(props: RateProps) {
  const {
    value,
    defaultValue = 0,
    count = 5,
    allowHalf = false,
    readonly = false,
    disabled = false,
    size = 'medium',
    activeColor,
    inactiveColor,
    icon = '★',
    voidIcon = '☆',
    onChange,
    className = '',
    style,
  } = props;

  const [innerValue, setInnerValue] = useState(defaultValue);
  const currentValue = value !== undefined ? value : innerValue;

  const handleClick = usePersistFn((index: number, isHalf: boolean) => {
    if (readonly || disabled) return;

    let newValue = index + 1;
    if (allowHalf && isHalf) {
      newValue = index + 0.5;
    }

    // 点击当前值时清零
    if (newValue === currentValue) {
      newValue = 0;
    }

    if (value === undefined) {
      setInnerValue(newValue);
    }
    onChange?.(newValue);
  });

  const rateClass = [
    'svton-rate',
    readonly ? 'svton-rate--readonly' : '',
    disabled ? 'svton-rate--disabled' : '',
    size !== 'medium' ? `svton-rate--${size}` : '',
    className,
  ].filter(Boolean).join(' ');

  const activeStyle: CSSProperties = activeColor ? { color: activeColor } : {};
  const inactiveStyle: CSSProperties = inactiveColor ? { color: inactiveColor } : {};

  return (
    <View className={rateClass} style={style}>
      {Array.from({ length: count }).map((_, index) => {
        const isFull = currentValue >= index + 1;
        const isHalf = allowHalf && currentValue > index && currentValue < index + 1;

        return (
          <View key={index} className="svton-rate__item">
            {/* 底层空星 */}
            <Text
              className="svton-rate__icon"
              style={inactiveStyle}
              onClick={() => handleClick(index, false)}
            >
              {voidIcon}
            </Text>

            {/* 满星 */}
            {isFull && (
              <Text
                className="svton-rate__icon svton-rate__icon--active"
                style={{ ...activeStyle, position: 'absolute', left: 0, top: 0 }}
                onClick={() => handleClick(index, false)}
              >
                {icon}
              </Text>
            )}

            {/* 半星 */}
            {isHalf && (
              <View
                className="svton-rate__icon svton-rate__icon--half"
                style={activeStyle}
                onClick={() => handleClick(index, true)}
              >
                <Text>{icon}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default Rate;
