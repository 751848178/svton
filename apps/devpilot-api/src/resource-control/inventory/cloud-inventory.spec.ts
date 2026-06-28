import {
  buildCloudInventorySeedsFromProviderPayload,
  buildFallbackCloudInventorySeeds,
} from './cloud-inventory';

const environment = {
  id: 'env-prod',
  projectId: 'project-1',
  key: 'prod',
  name: 'Production',
};

describe('cloud inventory adapter', () => {
  it('maps Aliyun RDS SDK response records to database managed resources', () => {
    const result = buildCloudInventorySeedsFromProviderPayload({
      DBInstances: [{
        DBInstanceId: 'rm-123',
        DBInstanceDescription: 'orders-prod',
        DBInstanceStatus: 'Running',
        Engine: 'MySQL',
        EngineVersion: '8.0',
        ConnectionString: 'rm-123.mysql.rds.aliyuncs.com',
        Port: 3306,
        DBInstanceClass: 'mysql.n2.medium.1',
        DBInstanceStorage: 100,
        Category: 'HighAvailability',
      }],
    }, {
      provider: 'aliyun-rds',
      region: 'cn-hangzhou',
      credentialId: 'credential-1',
      environment,
      syncMode: 'cloud_sdk_live',
    });

    expect(result).toMatchObject({
      parsedCount: 1,
      skippedCount: 0,
      errors: [],
    });
    expect(result.seeds[0]).toMatchObject({
      sourceType: 'cloud',
      provider: 'aliyun-rds',
      kind: 'database',
      name: 'orders-prod',
      externalId: 'aliyun-rds:cn-hangzhou:rm-123',
      status: 'active',
      endpoint: 'rm-123.mysql.rds.aliyuncs.com:3306',
      projectId: 'project-1',
      environmentId: 'env-prod',
      credentialId: 'credential-1',
      metadata: {
        syncMode: 'cloud_sdk_live',
        region: 'cn-hangzhou',
        environmentKey: 'prod',
        engine: 'MySQL',
        engineVersion: '8.0',
        instanceId: 'rm-123',
      },
      config: {
        engine: 'MySQL',
        instanceClass: 'mysql.n2.medium.1',
        storageGb: 100,
        category: 'HighAvailability',
        port: 3306,
      },
    });
  });

  it('maps Aliyun SLS project responses to log service managed resources', () => {
    const result = buildCloudInventorySeedsFromProviderPayload({
      projects: [{
        projectName: 'prod-logs',
        endpoint: 'cn-shanghai.log.aliyuncs.com',
        status: 'active',
        logstores: ['api', 'worker'],
        retentionDays: 60,
      }],
    }, {
      provider: 'aliyun-sls',
      region: 'cn-shanghai',
      environment,
      syncMode: 'cloud_sdk_live',
    });

    expect(result.seeds).toHaveLength(1);
    expect(result.seeds[0]).toMatchObject({
      provider: 'aliyun-sls',
      kind: 'log_service',
      name: 'prod-logs',
      externalId: 'aliyun-sls:cn-shanghai:prod-logs',
      endpoint: 'cn-shanghai.log.aliyuncs.com',
      config: {
        project: 'prod-logs',
        logstores: ['api', 'worker'],
        retentionDays: 60,
      },
    });
  });

  it('maps Tencent COS bucket responses to object storage managed resources', () => {
    const result = buildCloudInventorySeedsFromProviderPayload({
      Buckets: [{
        Name: 'asset-bucket-1250000000',
        Location: 'ap-shanghai',
        CreationDate: '2026-06-26T00:00:00Z',
        ACL: 'private',
        Versioning: 'Enabled',
      }],
    }, {
      provider: 'tencent-cos',
      region: 'ap-guangzhou',
      credentialId: 'credential-2',
      environment,
      syncMode: 'cloud_sdk_live',
    });

    expect(result.seeds[0]).toMatchObject({
      provider: 'tencent-cos',
      kind: 'object_storage',
      name: 'asset-bucket-1250000000',
      externalId: 'tencent-cos:ap-shanghai:asset-bucket-1250000000',
      endpoint: 'asset-bucket-1250000000.cos.ap-shanghai.myqcloud.com',
      credentialId: 'credential-2',
      metadata: {
        syncMode: 'cloud_sdk_live',
        region: 'ap-shanghai',
        adapterPackage: '@svton/nestjs-object-storage-tencent-cos',
      },
      config: {
        bucket: 'asset-bucket-1250000000',
        region: 'ap-shanghai',
        acl: 'private',
        versioning: true,
      },
    });
  });

  it('keeps fallback inventory explicitly marked as stub fallback', () => {
    const result = buildFallbackCloudInventorySeeds({
      provider: 'tencent-cos',
      region: 'ap-shanghai',
      credentialId: 'credential-2',
      environment,
      syncMode: 'ignored',
    });

    expect(result.seeds).toHaveLength(1);
    expect(result.seeds[0].metadata).toMatchObject({
      syncMode: 'cloud_inventory_stub_fallback',
      region: 'ap-shanghai',
      adapterPackage: '@svton/nestjs-object-storage-tencent-cos',
    });
  });

  it('skips malformed records without failing the whole mapping', () => {
    const result = buildCloudInventorySeedsFromProviderPayload({
      DBInstances: [
        { DBInstanceStatus: 'Running' },
        { DBInstanceId: 'rm-123', DBInstanceStatus: 'Running' },
      ],
    }, {
      provider: 'aliyun-rds',
      region: 'cn-hangzhou',
      environment,
      syncMode: 'cloud_sdk_live',
    });

    expect(result.parsedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toEqual(['cloud inventory record 1 is missing required identity fields']);
    expect(result.seeds).toHaveLength(1);
  });
});
