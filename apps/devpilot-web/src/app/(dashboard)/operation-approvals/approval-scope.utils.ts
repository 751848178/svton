/**
 * 操作审批 URL 范围工具
 *
 * 单一职责：URL 参数 <-> 审批列表查询 key/范围摘要。
 */

import type { ApprovalScope } from './types';

type SearchReader = { get(name: string): string | null };
type ScopeFilterKey = Exclude<keyof ApprovalScope, 'status'>;

const SCOPE_FILTER_KEYS: ScopeFilterKey[] = [
  'projectId',
  'environmentId',
  'category',
  'action',
  'targetType',
  'risk',
  'requesterId',
];

export function readApprovalScope(searchParams: SearchReader): ApprovalScope {
  return {
    status: readParam(searchParams, 'status'),
    projectId: readParam(searchParams, 'projectId'),
    environmentId: readParam(searchParams, 'environmentId'),
    category: readParam(searchParams, 'category'),
    action: readParam(searchParams, 'action'),
    targetType: readParam(searchParams, 'targetType'),
    risk: readParam(searchParams, 'risk'),
    requesterId: readParam(searchParams, 'requesterId'),
  };
}

export function buildApprovalListKey(status: string, scope: ApprovalScope = {}): string {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  SCOPE_FILTER_KEYS.forEach((key) => {
    const value = scope[key];
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `GET:/operation-approvals?${query}` : 'GET:/operation-approvals';
}

export function hasApprovalScope(scope: ApprovalScope): boolean {
  return SCOPE_FILTER_KEYS.some((key) => Boolean(scope[key]));
}

export function formatApprovalScope(scope: ApprovalScope): string {
  return [
    formatPart('项目', scope.projectId),
    formatPart('环境', scope.environmentId),
    formatPart('类别', scope.category),
    formatPart('动作', scope.action),
    formatPart('目标', scope.targetType),
    formatPart('风险', scope.risk),
    formatPart('申请人', scope.requesterId),
  ].filter(Boolean).join(' · ');
}

function readParam(searchParams: SearchReader, key: keyof ApprovalScope): string | undefined {
  return searchParams.get(key)?.trim() || undefined;
}

function formatPart(label: string, value?: string): string {
  return value ? `${label}:${value}` : '';
}
