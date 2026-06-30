/**
 * 访问策略域工具函数
 *
 * 单一职责：CSV 解析、数组读取、主体/范围标签（纯函数）。
 */

import type { AccessPolicy, PolicyForm } from './types';

export function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

export function formatList(value: unknown): string {
  const list = readStringArray(value);
  return list.length ? list.join(', ') : '全部';
}

export function formatRole(role?: string | null): string {
  if (role === 'owner') return '所有者';
  if (role === 'admin') return '管理员';
  if (role === 'member') return '成员';
  return '团队角色';
}

export function formatPrincipal(policy: AccessPolicy): string {
  if (policy.principalType === 'any') return '主体 任意成员';
  if (policy.principalType === 'user') {
    return `主体 ${policy.principalUser?.email || policy.principalUserId || '指定用户'}`;
  }
  return `主体 ${formatRole(policy.principalRole)}`;
}

export function formatScope(policy: AccessPolicy): string {
  const project = policy.project?.name || '全部项目';
  const environment = policy.environment?.name || '全部环境';
  return `范围 ${project} / ${environment}`;
}

/** 将策略回填为表单值。 */
export function policyToForm(policy: AccessPolicy): PolicyForm {
  return {
    name: policy.name,
    description: policy.description || '',
    enabled: policy.enabled,
    effect: policy.effect as PolicyForm['effect'],
    principalType: policy.principalType as PolicyForm['principalType'],
    principalRole: policy.principalRole || 'admin',
    principalUserId: policy.principalUserId || '',
    projectId: policy.project?.id || '',
    environmentId: policy.environment?.id || '',
    categories: readStringArray(policy.categories).join(', '),
    actions: readStringArray(policy.actions).join(', '),
    riskLevels: readStringArray(policy.riskLevels).join(', '),
    priority: String(policy.priority ?? 0),
  };
}
