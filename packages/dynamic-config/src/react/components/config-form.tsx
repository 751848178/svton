'use client';

import React from 'react';
import type { ConfigItem } from '../../core/types';
import { ConfigField, parseConfigValue, type ConfigFieldComponents } from './config-field';

export interface ConfigFormProps {
  /** 配置项列表 */
  configs: ConfigItem[];
  /** 当前值 */
  values: Record<string, any>;
  /** 值变更回调 */
  onChange: (key: string, value: any) => void;
  /** 保存回调 */
  onSave?: () => void;
  /** 是否正在保存 */
  saving?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** UI 组件 */
  components: ConfigFormComponents;
}

export interface ConfigFormComponents extends ConfigFieldComponents {
  Card: React.ComponentType<{
    children?: React.ReactNode;
    className?: string;
  }>;
  Button: React.ComponentType<{
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    className?: string;
  }>;
  Loader?: React.ComponentType<{
    className?: string;
  }>;
}

/**
 * 配置表单组件
 * 自动渲染配置项列表
 */
export function ConfigForm({
  configs,
  values,
  onChange,
  onSave,
  saving,
  disabled,
  components,
}: ConfigFormProps) {
  const { Card, Button, Label, Loader } = components;

  if (configs.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
          <p>该分类暂无配置项</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {configs.map((config) => (
          <div key={config.id} className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Label className="text-base font-medium">
                  {config.label}
                  {config.isRequired && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                {config.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {config.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {config.key}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-1 bg-gray-100 rounded">
                  {config.type}
                </span>
                {config.isPublic && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    公开
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2">
              <ConfigField
                config={config}
                value={values[config.key]}
                onChange={(value) => onChange(config.key, value)}
                disabled={disabled || saving}
                components={components}
              />
            </div>
          </div>
        ))}
      </div>

      {onSave && (
        <div className="mt-6 flex justify-end">
          <Button onClick={onSave} disabled={saving || disabled}>
            {saving && Loader && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            保存配置
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * 初始化配置表单值
 */
export function initConfigFormValues(configs: ConfigItem[]): Record<string, any> {
  const values: Record<string, any> = {};
  for (const config of configs) {
    values[config.key] = parseConfigValue(config.value, config.type as any);
  }
  return values;
}
