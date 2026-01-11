/**
 * SearchBar 搜索栏组件
 *
 * 功能特性：
 * - 搜索输入
 * - 清除按钮
 * - 取消按钮
 * - 自定义占位符
 */
import React, { useState, CSSProperties } from 'react';
import { View, Input, Text } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export type SearchBarShape = 'round' | 'square';

export interface SearchBarProps {
  /** 输入值 */
  value?: string;
  /** 占位符 */
  placeholder?: string;
  /** 形状 */
  shape?: SearchBarShape;
  /** 是否显示取消按钮 */
  showAction?: boolean;
  /** 取消按钮文字 */
  actionText?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自动聚焦 */
  autoFocus?: boolean;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 搜索回调 */
  onSearch?: (value: string) => void;
  /** 聚焦回调 */
  onFocus?: () => void;
  /** 失焦回调 */
  onBlur?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 清除回调 */
  onClear?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 左侧自定义内容 */
  left?: React.ReactNode;
  /** 右侧自定义内容 */
  right?: React.ReactNode;
}

export function SearchBar(props: SearchBarProps) {
  const {
    value = '',
    placeholder = '搜索',
    shape = 'round',
    showAction = false,
    actionText = '取消',
    disabled = false,
    autoFocus = false,
    onChange,
    onSearch,
    onFocus,
    onBlur,
    onCancel,
    onClear,
    className = '',
    style,
    left,
    right,
  } = props;

  const [focused, setFocused] = useState(false);

  const handleInput = usePersistFn((e: any) => {
    onChange?.(e.detail.value);
  });

  const handleFocus = usePersistFn(() => {
    setFocused(true);
    onFocus?.();
  });

  const handleBlur = usePersistFn(() => {
    setFocused(false);
    onBlur?.();
  });

  const handleClear = usePersistFn(() => {
    onChange?.('');
    onClear?.();
  });

  const handleConfirm = usePersistFn((e: any) => {
    onSearch?.(e.detail.value);
  });

  const handleCancel = usePersistFn(() => {
    onChange?.('');
    setFocused(false);
    onCancel?.();
  });

  const showClear = value && !disabled;
  const showActionBtn = showAction || focused;

  const searchBarClass = [
    'svton-search-bar',
    `svton-search-bar--${shape}`,
    focused ? 'svton-search-bar--focus' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={searchBarClass} style={style}>
      {left}

      <View className="svton-search-bar__input-wrap">
        <Text className="svton-search-bar__icon">🔍</Text>

        <Input
          className="svton-search-bar__input"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          focus={autoFocus}
          confirmType="search"
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onConfirm={handleConfirm}
        />

        {showClear && (
          <View className="svton-search-bar__clear" onClick={handleClear}>
            <Text>×</Text>
          </View>
        )}
      </View>

      {showActionBtn && (
        <View
          className={`svton-search-bar__action ${disabled ? 'svton-search-bar__action--disabled' : ''}`}
          onClick={handleCancel}
        >
          <Text>{actionText}</Text>
        </View>
      )}

      {right}
    </View>
  );
}

export default SearchBar;
