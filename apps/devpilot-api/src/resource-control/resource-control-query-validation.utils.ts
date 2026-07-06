/**
 * Pure SQL / query-validation + query-result-contract helpers.
 *
 * Extracted verbatim from `ResourceControlService` private methods so the
 * resource-query service and the facade share one implementation.
 * Stateless — no service / DB dependencies. No behavior change.
 */

export function queryResultContract(queryType: string) {
  if (queryType === 'sql') {
    return {
      shape: 'table',
      columns: [
        { key: 'column', label: 'Column', type: 'string', masked: false },
        { key: 'value', label: 'Value', type: 'string', masked: false },
      ],
      rowLimitDefault: 100, rowLimitMax: 1000,
    };
  }
  if (queryType === 'redis_scan') {
    return {
      shape: 'table',
      columns: [
        { key: 'cursor', label: 'Cursor', type: 'string', masked: false },
        { key: 'key', label: 'Key', type: 'string', masked: true },
        { key: 'type', label: 'Type', type: 'string', masked: false },
        { key: 'ttl', label: 'TTL', type: 'number', masked: false },
      ],
      rowLimitDefault: 100, rowLimitMax: 1000,
    };
  }
  if (queryType === 'sls_query') {
    return {
      shape: 'table',
      columns: [
        { key: 'time', label: 'Time', type: 'datetime', masked: false },
        { key: 'level', label: 'Level', type: 'string', masked: false },
        { key: 'message', label: 'Message', type: 'string', masked: true },
      ],
      rowLimitDefault: 100, rowLimitMax: 1000,
    };
  }
  if (queryType === 'cos_list') {
    return {
      shape: 'table',
      columns: [
        { key: 'key', label: 'Object Key', type: 'string', masked: false },
        { key: 'size', label: 'Size', type: 'number', masked: false },
        { key: 'lastModified', label: 'Last Modified', type: 'datetime', masked: false },
        { key: 'storageClass', label: 'Storage Class', type: 'string', masked: false },
      ],
      rowLimitDefault: 100, rowLimitMax: 1000,
    };
  }
  return {
    shape: 'key_value',
    columns: [
      { key: 'field', label: 'Field', type: 'string', masked: false },
      { key: 'value', label: 'Value', type: 'string', masked: true },
    ],
    rowLimitDefault: 100, rowLimitMax: 1000,
  };
}

export function maskQueryPreviewRow(row: Record<string, unknown>, secretPatterns: string[]) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const shouldMask = secretPatterns.some((pattern) => key.toLowerCase().includes(pattern.toLowerCase()));
      return [key, shouldMask ? '******' : value];
    }),
  );
}

export function stripSqlComments(query: string) {
  return query
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ')
    .replace(/#[^\n\r]*/g, ' ');
}

export function hasForbiddenSqlReadonlyPattern(normalizedSql: string) {
  return (
    /\b(insert|update|delete|drop|alter|create|truncate|replace|merge|grant|revoke|call|do|set|use|lock|unlock|analyze|optimize|repair|kill|load)\b/.test(
      normalizedSql,
    ) ||
    /\binto\s+(outfile|dumpfile)\b/.test(normalizedSql) ||
    /\bfor\s+update\b/.test(normalizedSql) ||
    /\block\s+in\s+share\s+mode\b/.test(normalizedSql) ||
    /\b(get_lock|release_lock|sleep|benchmark)\s*\(/.test(normalizedSql)
  );
}

export function validateReadOnlyQuery(queryType: string, query: string) {
  const cleanQuery = queryType === 'sql' ? stripSqlComments(query) : query;
  const normalized = cleanQuery.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) {
    return { ok: false, reason: '查询不能为空' };
  }

  if (queryType === 'sql') {
    if (/;.*\S/.test(normalized)) {
      return { ok: false, reason: 'SQL 查询计划只允许单条只读语句' };
    }
    if (hasForbiddenSqlReadonlyPattern(normalized)) {
      return { ok: false, reason: 'SQL 只读查询不允许写入、锁、文件、过程或高风险函数' };
    }
    if (/^select\b/.test(normalized)) {
      return { ok: true, reason: 'read-only sql' };
    }
    if (/^(show|describe|desc)\b/.test(normalized)) {
      return { ok: true, reason: 'read-only sql metadata' };
    }
    if (/^explain\s+(format\s*=\s*(json|tree|traditional)\s+)?select\b/.test(normalized)) {
      return { ok: true, reason: 'read-only sql' };
    }
    return { ok: false, reason: 'SQL 查询计划只允许 SELECT/SHOW/DESCRIBE/EXPLAIN' };
  }

  if (queryType === 'redis_scan') {
    if (/^(scan|info|ping|ttl|type|exists)\b/.test(normalized)) {
      return { ok: true, reason: 'read-only redis command' };
    }
    return { ok: false, reason: 'Redis 查询计划只允许 SCAN/INFO/PING/TTL/TYPE/EXISTS' };
  }

  if (queryType === 'sls_query' || queryType === 'cos_list' || queryType === 'metadata') {
    return { ok: true, reason: 'provider read operation' };
  }

  return { ok: false, reason: `不支持的查询类型: ${queryType}` };
}

export function isLiveQueryConfirmed(params: Record<string, unknown>) {
  return params.confirmLiveRead === true || params.confirmLiveRead === 'true';
}

export function canExecuteDirectDbLiveQuery(
  resource: { kind: string },
  credential: { transport: string },
  queryType: string,
) {
  return (
    credential.transport === 'direct_db' &&
    (resource.kind === 'mysql' || resource.kind === 'database' || resource.kind === 'redis') &&
    (queryType === 'sql' || queryType === 'redis_scan')
  );
}
