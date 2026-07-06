/**
 * Pure resource-query preview / planned-calls / live-prerequisites helpers.
 *
 * Extracted verbatim from `ResourceControlService` private methods so the
 * resource-query executor service stays under the 200-line ceiling. Stateless
 * — sample-row shaping, result-contract preview assembly, live-query
 * prerequisite checks, planned SDK/driver calls, and the executor-boundary
 * mapping. No behavior change.
 */

import { Prisma } from '@prisma/client';
import { ResolvedCredentialRef } from './credentials/credential-resolver';
import { asPositiveInt, asRecord, asString } from './resource-control-value.utils';
import { maskQueryPreviewRow } from './resource-control-query-validation.utils';

type ManagedResourceForConnection = {
  id: string; sourceType: string; provider: string; kind: string; name: string;
  externalId: string; status: string; endpoint: string | null;
  projectId: string | null; environmentId: string | null; serverId: string | null;
  credentialId: string | null; config: Prisma.JsonValue | null; metadata: Prisma.JsonValue | null;
};

type ResultContract = {
  shape: string;
  columns: Array<{ key: string; label: string; type: string; masked: boolean }>;
  rowLimitDefault: number; rowLimitMax: number;
};

export function sampleRowsForQueryPreview(
  resource: ManagedResourceForConnection, queryType: string, query: string,
): Array<Record<string, unknown>> {
  if (queryType === 'sql') {
    if (/^\s*select\s+1\s*;?\s*$/i.test(query)) return [{ column: '1', value: 1 }];
    if (/^\s*(show|describe|desc|explain)\b/i.test(query)) {
      return [
        { column: 'operation', value: query.trim().split(/\s+/).slice(0, 2).join(' ') },
        { column: 'target', value: resource.name },
      ];
    }
    return [
      { column: 'row_number', value: 1 },
      { column: 'preview', value: `${resource.provider}/${resource.kind}` },
    ];
  }
  if (queryType === 'redis_scan') {
    return [
      { cursor: '0', key: 'app:example:key', type: 'string', ttl: 3600 },
      { cursor: '0', key: 'app:example:hash', type: 'hash', ttl: -1 },
    ];
  }
  if (queryType === 'sls_query') {
    return [{ time: new Date(0).toISOString(), level: 'INFO', message: 'sample log line with sensitive fields masked before persistence' }];
  }
  if (queryType === 'cos_list') {
    const prefix = query || 'assets/';
    return [{ key: `${prefix}example.txt`, size: 128, lastModified: new Date(0).toISOString(), storageClass: 'STANDARD' }];
  }
  return [
    { field: 'provider', value: resource.provider },
    { field: 'kind', value: resource.kind },
    { field: 'endpoint', value: resource.endpoint || resource.externalId },
  ];
}

export function buildResourceQueryResultPreview(
  resource: ManagedResourceForConnection, queryType: string, query: string,
  params: Record<string, unknown>, contract: ResultContract,
) {
  const limit = asPositiveInt(params.limit, contract.rowLimitDefault, contract.rowLimitMax);
  const cursor = asString(params.cursor);
  const rows = sampleRowsForQueryPreview(resource, queryType, query);
  const redaction = {
    enabled: true, policy: 'mask_secret_like_columns_before_persisting',
    maskedColumnKeys: contract.columns.filter((column) => column.masked).map((column) => column.key),
    secretKeyPatterns: ['password', 'secret', 'token', 'credential', 'authorization', 'accessKey', 'secretKey'],
  };
  return {
    source: 'contract_sample', sample: true, shape: contract.shape, columns: contract.columns,
    rows: rows.map((row) => maskQueryPreviewRow(row, redaction.secretKeyPatterns)),
    pageInfo: { limit, returned: Math.min(rows.length, limit), hasMore: false, cursor: cursor || null, nextCursor: null },
    redaction,
    notes: [
      '当前结果来自只读 adapter 契约预览，不包含真实线上数据。',
      '真实 adapter 接入后会复用相同 columns/rows/pageInfo/redaction 结构。',
    ],
  };
}

export function livePrerequisitesForQuery(
  resource: ManagedResourceForConnection, credential: ResolvedCredentialRef,
  adapterKey: string, validation: { ok: boolean; reason: string }, liveAdapterReady = false,
) {
  const needsCloudCredential = resource.sourceType === 'cloud';
  const needsServerCredential = resource.sourceType === 'server';
  const needsDirectDbCredential = resource.kind === 'mysql' || resource.kind === 'database' || resource.kind === 'redis';
  const hasDirectDbCredential = credential.transport === 'direct_db';
  const credentialStatus = needsDirectDbCredential && hasDirectDbCredential
    ? 'ready'
    : needsCloudCredential ? (credential.source === 'team_credential' ? 'ready' : 'missing')
    : needsServerCredential ? (credential.source === 'server' ? 'ready' : 'missing') : 'missing';
  const credentialDetail = needsDirectDbCredential && hasDirectDbCredential
    ? 'Direct DB read-only credential is bound for query adapter.'
    : needsCloudCredential ? 'Cloud provider query requires TeamCredential binding.'
    : needsServerCredential ? 'Server resource query requires Server credential binding.'
    : 'Manual resource query requires a credential binding.';
  return [
    { key: 'read_only_validation', status: validation.ok ? 'ready' : 'blocked', detail: validation.reason },
    { key: 'credential_binding', status: credentialStatus, detail: credentialDetail },
    {
      key: 'read_only_driver_credential',
      status: needsDirectDbCredential ? (hasDirectDbCredential ? 'ready' : 'missing') : 'not_required',
      detail: needsDirectDbCredential
        ? hasDirectDbCredential
          ? 'Dedicated read-only account credential is bound; live driver adapter is still disabled.'
          : 'Database/Redis live query still needs a dedicated read-only account credential model.'
        : 'Provider SDK read operations use TeamCredential.',
    },
    {
      key: 'executor_adapter', status: liveAdapterReady ? 'ready' : 'missing',
      detail: liveAdapterReady
        ? `${adapterKey} live readonly transport is enabled for this run.`
        : `${adapterKey} live transport is not enabled for this run; current output is a dry-run result contract or blocked live request.`,
    },
  ];
}

export function plannedCallsForQuery(
  resource: ManagedResourceForConnection, queryType: string, query: string, params: Record<string, unknown>,
) {
  const config = asRecord(resource.config);
  const metadata = asRecord(resource.metadata);
  const region = asString(metadata.region) || asString(params.region) || 'default';
  if (queryType === 'sql') {
    return [{
      adapter: resource.provider === 'aliyun-rds' ? 'mysql-rds-driver' : 'mysql-docker-driver',
      operation: 'readonlyQuery',
      params: { endpoint: resource.endpoint, database: asString(params.database) || asString(config.database), sql: query },
    }];
  }
  if (queryType === 'redis_scan') {
    return [{ adapter: 'redis-driver', operation: 'readonlyCommand', params: { endpoint: resource.endpoint, command: query } }];
  }
  if (queryType === 'sls_query') {
    return [{
      provider: 'aliyun-sls', operation: 'GetLogs',
      params: { region, project: asString(config.project) || resource.name, logstore: asString(config.logstore), query, limit: asPositiveInt(params.limit, 100, 1000) },
    }];
  }
  if (queryType === 'cos_list') {
    return [{
      provider: 'tencent-cos', operation: 'GetBucket',
      params: { region, bucket: asString(config.bucket) || resource.name, prefix: query, maxKeys: asPositiveInt(params.limit, 100, 1000) },
    }];
  }
  return [{ provider: resource.provider, operation: 'DescribeResource', params: { resourceId: resource.externalId } }];
}

export function nextQueryExecutorBoundary(adapterKey: string) {
  const mapping: Record<string, string> = {
    'mysql-query-plan': 'mysql_driver_adapter',
    'redis-query-plan': 'redis_driver_adapter',
    'aliyun-sls-query-plan': 'aliyun_sls_sdk_adapter',
    'tencent-cos-query-plan': 'tencent_cos_sdk_adapter',
  };
  return mapping[adapterKey] || 'resource_query_adapter';
}
