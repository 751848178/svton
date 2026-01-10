'use client';

import React from 'react';
import { useDictionaryByCode } from '../hooks/use-dictionary';

export interface DictionarySelectComponents {
  Select: React.ComponentType<{
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }>;
  SelectTrigger: React.ComponentType<{
    children?: React.ReactNode;
    className?: string;
  }>;
  SelectValue: React.ComponentType<{
    placeholder?: string;
  }>;
  SelectContent: React.ComponentType<{
    children?: React.ReactNode;
  }>;
  SelectItem: React.ComponentType<{
    value: string;
    children?: React.ReactNode;
  }>;
  Loader?: React.ComponentType<{
    className?: string;
  }>;
}

export interface DictionarySelectProps {
  /** 字典编码 */
  code: string;
  /** 当前值 */
  value?: string;
  /** 值变更回调 */
  onChange?: (value: string) => void;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** UI 组件 */
  components: DictionarySelectComponents;
}

/**
 * 字典选择器组件
 * 根据字典编码自动加载选项
 */
export function DictionarySelect({
  code,
  value,
  onChange,
  placeholder = '请选择',
  disabled,
  className,
  components,
}: DictionarySelectProps) {
  const { items, loading, error } = useDictionaryByCode(code);
  const {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Loader,
  } = components;

  if (loading) {
    return (
      <div className={className}>
        {Loader ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <span>加载中...</span>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-500 text-sm ${className}`}>
        加载失败: {error.message}
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
