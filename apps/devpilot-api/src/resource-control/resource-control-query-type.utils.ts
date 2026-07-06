/**
 * Pure resource-query classification helpers for the resource-control feature.
 *
 * Extracted verbatim from `ResourceControlService` private methods. Stateless —
 * decide which query types a managed resource supports, whether a credential
 * type matches a direct-query resource, and normalize the outbound query text.
 * No behavior change.
 */

export function allowedQueryTypes(resource: { provider: string; kind: string }) {
  if (resource.kind === 'mysql' || resource.kind === 'database') {
    return ['sql'];
  }
  if (resource.kind === 'redis') {
    return ['redis_scan'];
  }
  if (resource.provider === 'aliyun-sls' || resource.kind === 'log_service') {
    return ['sls_query'];
  }
  if (resource.provider === 'tencent-cos' || resource.kind === 'object_storage') {
    return ['cos_list'];
  }
  return ['metadata'];
}

export function resolveQueryType(resource: { provider: string; kind: string }, requested?: string) {
  const allowed = allowedQueryTypes(resource);
  if (requested && allowed.includes(requested)) {
    return requested;
  }
  return allowed[0] || 'metadata';
}

export function requiresDirectQueryCredential(resource: { kind: string }) {
  return resource.kind === 'mysql' || resource.kind === 'database' || resource.kind === 'redis';
}

export function isDirectQueryCredentialType(resource: { kind: string }, credentialType: string) {
  if (resource.kind === 'mysql' || resource.kind === 'database') {
    return credentialType === 'db_mysql_readonly';
  }
  if (resource.kind === 'redis') {
    return credentialType === 'db_redis_readonly';
  }
  return false;
}

export function requiresResourceApproval(action: { mode: string; risk: string }, dryRun: boolean) {
  return !dryRun && (action.risk !== 'low' || action.mode !== 'read');
}

export function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export function resolveQueryExecutionShape(resource: { provider: string; kind: string }) {
  if (resource.kind === 'mysql' || resource.kind === 'database') {
    return { executorKey: 'direct-db-adapter', adapterKey: 'mysql-query-plan' };
  }
  if (resource.kind === 'redis') {
    return { executorKey: 'direct-db-adapter', adapterKey: 'redis-query-plan' };
  }
  if (resource.provider === 'aliyun-sls') {
    return { executorKey: 'cloud-sdk', adapterKey: 'aliyun-sls-query-plan' };
  }
  if (resource.provider === 'tencent-cos') {
    return { executorKey: 'cloud-sdk', adapterKey: 'tencent-cos-query-plan' };
  }
  return { executorKey: 'resource-query-adapter', adapterKey: 'metadata-query-plan' };
}

export function normalizeResourceQuery(
  resource: { provider: string; kind: string },
  queryType: string,
  query: string | undefined,
  params: Record<string, unknown> | undefined,
  asStringFn: (value: unknown) => string | undefined,
) {
  const trimmed = query?.trim();
  if (queryType === 'sql') {
    return trimmed || 'SELECT 1';
  }
  if (queryType === 'redis_scan') {
    return trimmed || 'SCAN 0 COUNT 20';
  }
  if (queryType === 'sls_query') {
    return trimmed || '*';
  }
  if (queryType === 'cos_list') {
    return asStringFn(params?.prefix) || trimmed || '';
  }
  return trimmed || `${resource.provider}/${resource.kind} metadata`;
}
