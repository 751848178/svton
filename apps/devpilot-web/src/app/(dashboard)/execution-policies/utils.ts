/**
 * 执行策略域工具函数
 *
 * 单一职责：纯函数（数组解析、序列化、标签生成）。
 */

import type { PolicyTemplate, PolicyForm } from './types';

export const EMPTY_FORM: PolicyForm = {
  name: '',
  description: '',
  projectId: '',
  environmentId: '',
  enabled: true,
  priority: '0',
  adapterKeys: '',
  operationKeys: '',
  allowedPatterns: '',
  blockedPatterns: '',
};

/** 读取可能是 string[] 的字段，过滤无效项。 */
export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/** 逗号分隔 → 去重数组。 */
export function parseCsv(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

/** 换行分隔 → 去重数组。 */
export function parseLines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function listLabel(values: string[]): string {
  return values.length ? values.join(', ') : '全部';
}

/** 策略作用域标签。 */
export function scopeLabel(template: PolicyTemplate): string {
  if (template.environment) return `环境 ${template.environment.name}`;
  if (template.project) return `项目 ${template.project.name}`;
  return '团队全局';
}

/** 将模板回填为表单值。 */
export function templateToForm(template: PolicyTemplate): PolicyForm {
  return {
    name: template.name,
    description: template.description || '',
    projectId: template.project?.id || '',
    environmentId: template.environment?.id || '',
    enabled: template.enabled,
    priority: String(template.priority ?? 0),
    adapterKeys: readStringArray(template.adapterKeys).join(', '),
    operationKeys: readStringArray(template.operationKeys).join(', '),
    allowedPatterns: readStringArray(template.allowedPatterns).join('\n'),
    blockedPatterns: readStringArray(template.blockedPatterns).join('\n'),
  };
}
