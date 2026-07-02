/**
 * 执行治理 URL 范围工具
 *
 * 单一职责：URL 参数 -> 执行任务查询参数/范围摘要。
 */

import type { ExecutionGovernanceScope } from './types';

type SearchReader = { get(name: string): string | null };
type JobScopeFilterKey = Exclude<keyof ExecutionGovernanceScope, 'jobStatus' | 'leaseStatus'>;

const JOB_SCOPE_FILTER_KEYS: JobScopeFilterKey[] = [
  'projectId',
  'environmentId',
  'serverId',
  'operationKey',
  'adapterKey',
  'queueMode',
];

export function readExecutionGovernanceScope(
  searchParams: SearchReader,
): ExecutionGovernanceScope {
  return {
    jobStatus: readParam(searchParams, 'jobStatus'),
    leaseStatus: readParam(searchParams, 'leaseStatus'),
    projectId: readParam(searchParams, 'projectId'),
    environmentId: readParam(searchParams, 'environmentId'),
    serverId: readParam(searchParams, 'serverId'),
    operationKey: readParam(searchParams, 'operationKey'),
    adapterKey: readParam(searchParams, 'adapterKey'),
    queueMode: readParam(searchParams, 'queueMode'),
  };
}

export function buildExecutionJobParams(
  jobStatus: string,
  scope: ExecutionGovernanceScope,
): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  if (jobStatus !== 'all') params.status = jobStatus;
  JOB_SCOPE_FILTER_KEYS.forEach((key) => {
    const value = scope[key];
    if (value) params[key] = value;
  });
  return Object.keys(params).length > 0 ? params : undefined;
}

export function buildExecutionLeaseParams(
  leaseStatus: string,
  scope: ExecutionGovernanceScope,
): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  if (leaseStatus !== 'all') params.status = leaseStatus;
  ['projectId', 'environmentId', 'serverId', 'operationKey', 'adapterKey'].forEach((key) => {
    const value = scope[key as JobScopeFilterKey];
    if (value) params[key] = value;
  });
  return Object.keys(params).length > 0 ? params : undefined;
}

export function buildExecutionJobScopeKey(scope: ExecutionGovernanceScope): string {
  return [
    `leaseStatus:${scope.leaseStatus || ''}`,
    ...JOB_SCOPE_FILTER_KEYS.map((key) => `${key}:${scope[key] || ''}`),
  ].join('|');
}

export function formatExecutionJobScope(scope: ExecutionGovernanceScope): string {
  return [
    formatPart('项目', scope.projectId),
    formatPart('环境', scope.environmentId),
    formatPart('服务器', scope.serverId),
    formatPart('操作', scope.operationKey),
    formatPart('执行器', scope.adapterKey),
    formatPart('队列', scope.queueMode),
  ].filter(Boolean).join(' · ');
}

function readParam(
  searchParams: SearchReader,
  key: keyof ExecutionGovernanceScope,
): string | undefined {
  return searchParams.get(key)?.trim() || undefined;
}

function formatPart(label: string, value?: string): string {
  return value ? `${label}:${value}` : '';
}
