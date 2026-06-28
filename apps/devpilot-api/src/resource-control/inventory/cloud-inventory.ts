export type CloudInventoryProvider = 'aliyun-rds' | 'aliyun-sls' | 'tencent-cos';

export type CloudInventoryEnvironment = {
  id: string;
  projectId: string;
  key: string;
  name: string;
};

export type CloudInventoryResourceSeed = {
  sourceType: string;
  provider: string;
  kind: string;
  name: string;
  externalId: string;
  status: string;
  endpoint?: string;
  projectId?: string;
  environmentId?: string;
  credentialId?: string;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

export type CloudInventoryOptions = {
  provider: CloudInventoryProvider;
  region: string;
  credentialId?: string;
  environment?: CloudInventoryEnvironment | null;
  syncMode: string;
};

export type CloudInventoryResult = {
  seeds: CloudInventoryResourceSeed[];
  parsedCount: number;
  skippedCount: number;
  errors: string[];
};

export function buildCloudInventorySeedsFromProviderPayload(
  payload: unknown,
  options: CloudInventoryOptions,
): CloudInventoryResult {
  if (options.provider === 'aliyun-rds') {
    return buildAliyunRdsSeeds(payload, options);
  }
  if (options.provider === 'aliyun-sls') {
    return buildAliyunSlsSeeds(payload, options);
  }
  return buildTencentCosSeeds(payload, options);
}

export function buildFallbackCloudInventorySeeds(options: CloudInventoryOptions): CloudInventoryResult {
  return buildCloudInventorySeedsFromProviderPayload(fallbackPayload(options.provider, options.region), {
    ...options,
    syncMode: 'cloud_inventory_stub_fallback',
  });
}

function buildAliyunRdsSeeds(payload: unknown, options: CloudInventoryOptions): CloudInventoryResult {
  return mapRecords(readRecords(payload, ['items', 'Items', 'DBInstances', 'DBInstance']), (record) => {
    const instanceId = readString(record, ['DBInstanceId', 'instanceId', 'id']);
    if (!instanceId) return null;
    const name = readString(record, ['DBInstanceDescription', 'DBInstanceId', 'name']) || instanceId;
    const port = readNumber(record, ['Port', 'port']) || 3306;
    const connectionString = readString(record, ['ConnectionString', 'connectionString', 'endpoint']);
    const endpoint = connectionString ? `${connectionString}:${port}` : undefined;
    const engine = readString(record, ['Engine', 'engine']) || 'mysql';

    return {
      sourceType: 'cloud',
      provider: options.provider,
      kind: 'database',
      name,
      externalId: `${options.provider}:${options.region}:${instanceId}`,
      status: normalizeCloudStatus(readString(record, ['DBInstanceStatus', 'Status', 'status'])),
      endpoint,
      projectId: options.environment?.projectId,
      environmentId: options.environment?.id,
      credentialId: options.credentialId,
      metadata: baseMetadata(options, {
        engine,
        engineVersion: readString(record, ['EngineVersion', 'engineVersion']),
        instanceId,
        adapterPackage: 'aliyun-openapi-sdk',
      }),
      config: {
        engine,
        instanceClass: readString(record, ['DBInstanceClass', 'instanceClass']),
        storageGb: readNumber(record, ['DBInstanceStorage', 'storageGb']),
        category: readString(record, ['Category', 'category']),
        port,
      },
    };
  });
}

function buildAliyunSlsSeeds(payload: unknown, options: CloudInventoryOptions): CloudInventoryResult {
  return mapRecords(readRecords(payload, ['projects', 'Projects', 'items', 'Items']), (record) => {
    const project = readString(record, ['projectName', 'ProjectName', 'project', 'name']);
    if (!project) return null;
    const endpoint = readString(record, ['endpoint', 'Endpoint']) || `${options.region}.log.aliyuncs.com`;
    const logstores = readStringArray(record, ['logstores', 'Logstores']);

    return {
      sourceType: 'cloud',
      provider: options.provider,
      kind: 'log_service',
      name: project,
      externalId: `${options.provider}:${options.region}:${project}`,
      status: normalizeCloudStatus(readString(record, ['status', 'Status']) || 'active'),
      endpoint,
      projectId: options.environment?.projectId,
      environmentId: options.environment?.id,
      credentialId: options.credentialId,
      metadata: baseMetadata(options, {
        adapterPackage: '@svton/nestjs-logger',
        transport: 'aliyunSls',
        description: readString(record, ['description', 'Description']),
      }),
      config: {
        project,
        logstores,
        retentionDays: readNumber(record, ['retentionDays', 'RetentionDays']),
      },
    };
  });
}

function buildTencentCosSeeds(payload: unknown, options: CloudInventoryOptions): CloudInventoryResult {
  return mapRecords(readRecords(payload, ['Buckets', 'buckets', 'items', 'Items']), (record) => {
    const bucket = readString(record, ['Name', 'Bucket', 'bucket', 'name']);
    if (!bucket) return null;
    const region = readString(record, ['Location', 'Region', 'region']) || options.region;

    return {
      sourceType: 'cloud',
      provider: options.provider,
      kind: 'object_storage',
      name: bucket,
      externalId: `${options.provider}:${region}:${bucket}`,
      status: normalizeCloudStatus(readString(record, ['Status', 'status']) || 'active'),
      endpoint: `${bucket}.cos.${region}.myqcloud.com`,
      projectId: options.environment?.projectId,
      environmentId: options.environment?.id,
      credentialId: options.credentialId,
      metadata: baseMetadata({ ...options, region }, {
        adapterPackage: '@svton/nestjs-object-storage-tencent-cos',
        creationDate: readString(record, ['CreationDate', 'creationDate']),
      }),
      config: {
        bucket,
        region,
        acl: readString(record, ['ACL', 'acl']),
        versioning: readBoolean(record, ['Versioning', 'versioning']),
      },
    };
  });
}

function mapRecords(
  records: Array<Record<string, unknown>>,
  mapper: (record: Record<string, unknown>) => CloudInventoryResourceSeed | null,
): CloudInventoryResult {
  const seeds: CloudInventoryResourceSeed[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  records.forEach((record, index) => {
    const seed = mapper(record);
    if (seed) {
      seeds.push(seed);
      return;
    }
    skippedCount += 1;
    errors.push(`cloud inventory record ${index + 1} is missing required identity fields`);
  });

  return {
    seeds,
    parsedCount: records.length,
    skippedCount,
    errors,
  };
}

function readRecords(payload: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }
  if (!isRecord(payload)) {
    return [];
  }
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
    if (isRecord(value)) {
      const nested = Object.values(value);
      const nestedArray = nested.find((item): item is Array<Record<string, unknown>> =>
        Array.isArray(item) && item.every(isRecord),
      );
      if (nestedArray) {
        return nestedArray;
      }
      if (nested.every(isRecord)) {
        return nested as Array<Record<string, unknown>>;
      }
    }
  }
  return [payload];
}

function fallbackPayload(provider: CloudInventoryProvider, region: string) {
  if (provider === 'aliyun-rds') {
    return [{
      DBInstanceId: 'rm-svton-demo',
      DBInstanceDescription: 'prod-rds-mysql',
      DBInstanceStatus: 'Running',
      Engine: 'mysql',
      EngineVersion: '8.0',
      ConnectionString: 'rm-svton-demo.mysql.rds.aliyuncs.com',
      Port: 3306,
      DBInstanceClass: 'mysql.n2.medium.1',
      DBInstanceStorage: 50,
      Category: 'Basic',
    }];
  }
  if (provider === 'aliyun-sls') {
    return [{
      projectName: 'devpilot-log-project',
      endpoint: `${region}.log.aliyuncs.com`,
      status: 'active',
      logstores: ['app-logs'],
      retentionDays: 30,
    }];
  }
  return [{
    Name: 'svton-assets',
    Location: region,
    Status: 'active',
    ACL: 'private',
    Versioning: false,
  }];
}

function baseMetadata(options: CloudInventoryOptions, extra: Record<string, unknown>) {
  return {
    syncMode: options.syncMode,
    region: options.region,
    environmentKey: options.environment?.key,
    ...extra,
  };
}

function normalizeCloudStatus(value?: string) {
  const status = (value || '').toLowerCase();
  if (['running', 'active', 'available', 'normal', 'enabled'].includes(status)) return 'active';
  if (['stopped', 'inactive', 'disabled'].includes(status)) return 'inactive';
  if (['deleting', 'deleted', 'error', 'failed'].includes(status)) return 'error';
  return 'unknown';
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  const value = readString(record, keys);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true' || value.toLowerCase() === 'enabled') return true;
      if (value.toLowerCase() === 'false' || value.toLowerCase() === 'disabled') return false;
    }
  }
  return undefined;
}

function readStringArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean);
    }
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
