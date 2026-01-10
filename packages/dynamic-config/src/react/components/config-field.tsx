'use client';

import React from 'react';
import type { BaseConfigFieldProps } from '../types';
import type { ConfigValueType } from '../../core/types';

/**
 * 配置字段渲染器
 * 根据配置类型自动渲染对应的表单控件
 *
 * 注意：此组件需要配合 shadcn/ui 组件使用
 * 用户需要在项目中安装并配置 shadcn/ui
 *
 * @example
 * ```tsx
 * // 用户项目中需要提供 UI 组件
 * import { Input, Switch, Textarea, Select } from '@/components/ui';
 *
 * // 然后使用 ConfigField
 * <ConfigField
 *   config={config}
 *   value={value}
 *   onChange={handleChange}
 *   components={{ Input, Switch, Textarea, Select }}
 * />
 * ```
 */

export interface ConfigFieldComponents {
  Input: React.ComponentType<{
    type?: string;
    value?: any;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }>;
  Switch: React.ComponentType<{
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }>;
  Textarea: React.ComponentType<{
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    className?: string;
  }>;
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
  Label: React.ComponentType<{
    children?: React.ReactNode;
    className?: string;
  }>;
}

export interface ConfigFieldWithComponentsProps extends BaseConfigFieldProps {
  components: ConfigFieldComponents;
}

export function ConfigField({
  config,
  value,
  onChange,
  disabled,
  components,
}: ConfigFieldWithComponentsProps) {
  const {
    Input,
    Switch,
    Textarea,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Label,
  } = components;

  const type = config.type as ConfigValueType;

  switch (type) {
    case 'boolean':
      return (
        <div className="flex items-center space-x-3">
          <Switch
            checked={value ?? false}
            onCheckedChange={onChange}
            disabled={disabled}
          />
          <Label className="text-sm font-medium">
            {value ? '启用' : '禁用'}
          </Label>
        </div>
      );

    case 'number':
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={config.defaultValue ?? undefined}
          disabled={disabled}
        />
      );

    case 'password':
      return (
        <Input
          type="password"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          disabled={disabled}
        />
      );

    case 'json':
    case 'array':
      return (
        <Textarea
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder={config.defaultValue ?? undefined}
          rows={4}
          disabled={disabled}
          className="font-mono text-sm"
        />
      );

    case 'enum':
      const options = config.options ? JSON.parse(config.options) : [];
      return (
        <Select
          value={value}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: { label: string; value: string }) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'string':
    default:
      return (
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.defaultValue ?? undefined}
          disabled={disabled}
        />
      );
  }
}

/**
 * 解析配置值（用于表单初始化）
 */
export function parseConfigValue(value: string, type: ConfigValueType): any {
  try {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        if (typeof value === 'boolean') return value;
        return value === 'true' || value === '1';
      case 'json':
      case 'array':
        return JSON.parse(value);
      default:
        // 移除首尾引号
        if (typeof value === 'string') {
          return value.replace(/^"|"$/g, '');
        }
        return value;
    }
  } catch {
    return value;
  }
}
