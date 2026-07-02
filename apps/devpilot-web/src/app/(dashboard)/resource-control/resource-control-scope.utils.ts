/**
 * ResourceControl URL scope helpers.
 *
 * Single responsibility: URL params -> API params and human readable scope.
 */

export interface ResourceControlScope {
  projectId?: string;
  environmentId?: string;
  resourceId?: string;
  provider?: string;
  kind?: string;
  status?: string;
  action?: string;
  actionStatus?: string;
  connectionStatus?: string;
  queryStatus?: string;
  queryType?: string;
}

type SearchReader = { get(name: string): string | null };
type ApiParams = Record<string, string>;

const LIST_KEYS: Array<keyof ResourceControlScope> = [
  'projectId',
  'environmentId',
  'resourceId',
  'provider',
  'kind',
  'status',
];

export function readResourceControlScope(searchParams: SearchReader): ResourceControlScope {
  return {
    projectId: readParam(searchParams, 'projectId'),
    environmentId: readParam(searchParams, 'environmentId'),
    resourceId: readParam(searchParams, 'resourceId'),
    provider: readParam(searchParams, 'provider'),
    kind: readParam(searchParams, 'kind'),
    status: readParam(searchParams, 'status'),
    action: readParam(searchParams, 'action'),
    actionStatus: readParam(searchParams, 'actionStatus'),
    connectionStatus: readParam(searchParams, 'connectionStatus'),
    queryStatus: readParam(searchParams, 'queryStatus'),
    queryType: readParam(searchParams, 'queryType'),
  };
}

export function buildResourceListParams(
  scope: ResourceControlScope,
  filters: Pick<ResourceControlScope, 'provider' | 'kind' | 'status'>,
): ApiParams | undefined {
  return nonEmptyParams({
    projectId: scope.projectId,
    environmentId: scope.environmentId,
    resourceId: scope.resourceId,
    provider: filters.provider || scope.provider,
    kind: filters.kind || scope.kind,
    status: filters.status || scope.status,
  });
}

export function buildResourceActionRunParams(scope: ResourceControlScope): ApiParams | undefined {
  return nonEmptyParams({
    projectId: scope.projectId,
    environmentId: scope.environmentId,
    resourceId: scope.resourceId,
    action: scope.action,
    status: scope.actionStatus,
  });
}

export function buildResourceConnectionRunParams(scope: ResourceControlScope): ApiParams | undefined {
  return nonEmptyParams({
    projectId: scope.projectId,
    environmentId: scope.environmentId,
    resourceId: scope.resourceId,
    provider: scope.provider,
    kind: scope.kind,
    status: scope.connectionStatus,
  });
}

export function buildResourceQueryRunParams(scope: ResourceControlScope): ApiParams | undefined {
  return nonEmptyParams({
    projectId: scope.projectId,
    environmentId: scope.environmentId,
    resourceId: scope.resourceId,
    provider: scope.provider,
    kind: scope.kind,
    status: scope.queryStatus,
    queryType: scope.queryType,
  });
}

export function buildResourceControlScopeKey(scope: ResourceControlScope): string {
  return [
    ...LIST_KEYS,
    'action',
    'actionStatus',
    'connectionStatus',
    'queryStatus',
    'queryType',
  ].map((key) => `${key}:${scope[key as keyof ResourceControlScope] || ''}`).join('|');
}

export function hasResourceControlScope(scope: ResourceControlScope): boolean {
  return buildResourceControlScopeKey(scope).split('|').some((part) => !part.endsWith(':'));
}

export function formatResourceControlScope(scope: ResourceControlScope): string {
  return [
    formatPart('项目', scope.projectId),
    formatPart('环境', scope.environmentId),
    formatPart('资源', scope.resourceId),
    formatPart('Provider', scope.provider),
    formatPart('类型', scope.kind),
    formatPart('资源状态', scope.status),
    formatPart('动作', scope.action),
    formatPart('动作状态', scope.actionStatus),
    formatPart('连接状态', scope.connectionStatus),
    formatPart('查询状态', scope.queryStatus),
    formatPart('查询类型', scope.queryType),
  ].filter(Boolean).join(' · ');
}

function readParam(searchParams: SearchReader, key: keyof ResourceControlScope): string | undefined {
  return searchParams.get(key)?.trim() || undefined;
}

function nonEmptyParams(params: Record<string, string | undefined>): ApiParams | undefined {
  const clean: ApiParams = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value) clean[key] = value;
  });
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function formatPart(label: string, value?: string): string {
  return value ? `${label}:${value}` : '';
}
