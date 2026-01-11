/**
 * Input 输入框组件
 *
 * 功能特性：
 * - 多种样式（默认、无边框、填充）
 * - 前缀/后缀
 * - 清除按钮
 * - 字数统计
 * - 禁用/错误状态
 */
import React, { CSSProperties, ReactNode } from 'react';
import { View, Input as TaroInput, Text, Textarea as TaroTextarea } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export type InputVariant = 'outlined' | 'borderless' | 'filled';

export interface InputProps {
  /** 输入值 */
  value?: string;
  /** 占位符 */
  placeholder?: string;
  /** 输入类型 */
  type?: 'text' | 'number' | 'idcard' | 'digit' | 'nickname';
  /** 是否密码输入 */
  password?: boolean;
  /** 样式变体 */
  variant?: InputVariant;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 是否错误状态 */
  error?: boolean;
  /** 最大长度 */
  maxLength?: number;
  /** 是否显示清除按钮 */
  clearable?: boolean;
  /** 是否显示字数统计 */
  showCount?: boolean;
  /** 前缀内容 */
  prefix?: ReactNode;
  /** 后缀内容 */
  suffix?: ReactNode;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 聚焦回调 */
  onFocus?: () => void;
  /** 失焦回调 */
  onBlur?: () => void;
  /** 确认回调 */
  onConfirm?: (value: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 自动聚焦 */
  autoFocus?: boolean;
  /** 确认按钮文字 */
  confirmType?: 'send' | 'search' | 'next' | 'go' | 'done';
}

export function Input(props: InputProps) {
  const {
    value = '',
    placeholder = '请输入',
    type = 'text',
    password = false,
    variant = 'outlined',
    disabled = false,
    readonly = false,
    error = false,
    maxLength,
    clearable = false,
    showCount = false,
    prefix,
    suffix,
    onChange,
    onFocus,
    onBlur,
    onConfirm,
    className = '',
    style,
    autoFocus = false,
    confirmType = 'done',
  } = props;

  const handleInput = usePersistFn((e: any) => {
    onChange?.(e.detail.value);
  });

  const handleClear = usePersistFn(() => {
    onChange?.('');
  });

  const handleConfirm = usePersistFn((e: any) => {
    onConfirm?.(e.detail.value);
  });

  const showClear = clearable && value && !disabled && !readonly;

  const inputClass = [
    'svton-input',
    variant !== 'outlined' ? `svton-input--${variant}` : '',
    disabled ? 'svton-input--disabled' : '',
    error ? 'svton-input--error' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={inputClass} style={style}>
      {prefix && <View className="svton-input__prefix">{prefix}</View>}

      <TaroInput
        className="svton-input__inner"
        value={value}
        type={type}
        password={password}
        placeholder={placeholder}
        disabled={disabled}
        maxlength={maxLength || -1}
        focus={autoFocus}
        confirmType={confirmType}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onConfirm={handleConfirm}
      />

      {showClear && (
        <View className="svton-input__clear" onClick={handleClear}>
          <Text>×</Text>
        </View>
      )}

      {showCount && maxLength && (
        <View className="svton-input__count">
          <Text>{value.length}/{maxLength}</Text>
        </View>
      )}

      {suffix && <View className="svton-input__suffix">{suffix}</View>}
    </View>
  );
}

// Textarea 组件
export interface TextareaProps {
  value?: string;
  placeholder?: string;
  variant?: InputVariant;
  disabled?: boolean;
  error?: boolean;
  maxLength?: number;
  showCount?: boolean;
  autoHeight?: boolean;
  rows?: number;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
}

export function Textarea(props: TextareaProps) {
  const {
    value = '',
    placeholder = '请输入',
    variant = 'outlined',
    disabled = false,
    error = false,
    maxLength,
    showCount = false,
    autoHeight = false,
    onChange,
    onFocus,
    onBlur,
    className = '',
    style,
    autoFocus = false,
  } = props;

  const handleInput = usePersistFn((e: any) => {
    onChange?.(e.detail.value);
  });

  const textareaClass = [
    'svton-textarea',
    variant !== 'outlined' ? `svton-textarea--${variant}` : '',
    disabled ? 'svton-textarea--disabled' : '',
    error ? 'svton-textarea--error' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={textareaClass} style={style}>
      <TaroTextarea
        className="svton-textarea__inner"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxlength={maxLength || -1}
        autoHeight={autoHeight}
        focus={autoFocus}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
      />

      {showCount && maxLength && (
        <View className="svton-textarea__footer">
          <Text className="svton-textarea__count">{value.length}/{maxLength}</Text>
        </View>
      )}
    </View>
  );
}

export default Input;
