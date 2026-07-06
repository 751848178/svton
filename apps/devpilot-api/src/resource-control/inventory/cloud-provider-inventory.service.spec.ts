import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { createTestCryptoService } from '../../common/crypto/crypto.test-helpers';
import { CloudProviderInventoryService } from './cloud-provider-inventory.service';

const environment = {
  id: 'env-prod',
  projectId: 'project-1',
  key: 'prod',
  name: 'Production',
};

const credential = {
  id: 'credential-1',
  name: 'Tencent COS readonly',
  type: 'cloud_tencent',
};

const aliyunCredential = {
  id: 'credential-aliyun',
  name: 'Aliyun readonly',
  type: 'cloud_aliyun',
};

describe('CloudProviderInventoryService', () => {
  let prisma: { teamCredential: { findFirst: jest.Mock } };
  let config: { get: jest.Mock };
  let service: CloudProviderInventoryService;

  beforeEach(() => {
    prisma = {
      teamCredential: {
        findFirst: jest.fn(),
      },
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'false';
        if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
        return fallback;
      }),
    };
    service = new CloudProviderInventoryService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      createTestCryptoService('test-cloud-inventory-key'),
    );
  });

  it('uses explicit fallback inventory when live cloud inventory is disabled', async () => {
    const result = await service.collect({
      teamId: 'team-1',
      provider: 'tencent-cos',
      region: 'ap-shanghai',
      credential,
      environment,
    });

    expect(prisma.teamCredential.findFirst).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      provider: 'tencent-cos',
      syncMode: 'cloud_inventory_stub_fallback',
      live: false,
      fallbackReason: 'Cloud provider live inventory is disabled',
    });
    expect(result.seeds[0]).toMatchObject({
      provider: 'tencent-cos',
      kind: 'object_storage',
      credentialId: 'credential-1',
      environmentId: 'env-prod',
    });
  });

  it('lists Tencent COS buckets through SDK when live inventory is enabled', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
      return fallback;
    });
    prisma.teamCredential.findFirst.mockResolvedValue({
      config: encryptCredential({
        secretId: 'secret-id',
        secretKey: 'secret-key',
        defaultRegion: 'ap-guangzhou',
      }),
    });

    class FakeCOS {
      static options: Record<string, unknown> | null = null;

      constructor(options: Record<string, unknown>) {
        FakeCOS.options = options;
      }

      getService(callback: (error: unknown, data: unknown) => void) {
        callback(null, {
          Buckets: [{
            Name: 'asset-bucket-1250000000',
            Location: 'ap-shanghai',
            CreationDate: '2026-06-26T00:00:00Z',
            ACL: 'private',
            Versioning: 'Enabled',
          }],
        });
      }
    }

    (service as unknown as { loadCosSdk: jest.Mock }).loadCosSdk = jest
      .fn()
      .mockResolvedValue(FakeCOS);

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'tencent-cos',
      region: 'ap-guangzhou',
      credential,
      environment,
    });

    expect(prisma.teamCredential.findFirst).toHaveBeenCalledWith({
      where: { id: 'credential-1', teamId: 'team-1' },
      select: { config: true },
    });
    expect(FakeCOS.options).toEqual({
      SecretId: 'secret-id',
      SecretKey: 'secret-key',
    });
    expect(result).toMatchObject({
      provider: 'tencent-cos',
      syncMode: 'cloud_sdk_live',
      live: true,
      sdk: 'cos-nodejs-sdk-v5',
      parsedCount: 1,
      skippedCount: 0,
      errors: [],
    });
    expect(result.seeds[0]).toMatchObject({
      provider: 'tencent-cos',
      kind: 'object_storage',
      name: 'asset-bucket-1250000000',
      externalId: 'tencent-cos:ap-shanghai:asset-bucket-1250000000',
      endpoint: 'asset-bucket-1250000000.cos.ap-shanghai.myqcloud.com',
      credentialId: 'credential-1',
      projectId: 'project-1',
      environmentId: 'env-prod',
      metadata: {
        syncMode: 'cloud_sdk_live',
        region: 'ap-shanghai',
        environmentKey: 'prod',
      },
    });
  });

  it('falls back when the bound credential type is not Tencent cloud', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      return fallback;
    });

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'tencent-cos',
      region: 'ap-shanghai',
      credential: { ...credential, type: 'cloud_aliyun' },
      environment,
    });

    expect(prisma.teamCredential.findFirst).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      syncMode: 'cloud_inventory_stub_fallback',
      live: false,
      fallbackReason: 'Tencent COS inventory requires a cloud_tencent TeamCredential',
    });
  });

  it('records provider errors as fallback metadata instead of failing sync', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
      return fallback;
    });
    prisma.teamCredential.findFirst.mockResolvedValue({
      config: encryptCredential({
        secretId: 'secret-id',
        secretKey: 'secret-key',
      }),
    });

    class FailingCOS {
      getService(callback: (error: unknown, data?: unknown) => void) {
        callback({ message: 'AccessDenied' });
      }
    }

    (service as unknown as { loadCosSdk: jest.Mock }).loadCosSdk = jest
      .fn()
      .mockResolvedValue(FailingCOS);

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'tencent-cos',
      region: 'ap-shanghai',
      credential,
      environment,
    });

    expect(result).toMatchObject({
      syncMode: 'cloud_inventory_stub_fallback',
      live: false,
    });
    expect(result.fallbackReason).toContain('Tencent COS live inventory failed: AccessDenied');
  });

  it('records Tencent COS SDK timeouts as fallback metadata', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
      return fallback;
    });
    prisma.teamCredential.findFirst.mockResolvedValue({
      config: encryptCredential({
        secretId: 'secret-id',
        secretKey: 'secret-key',
        inventoryTimeoutMs: 5,
        inventoryRetryAttempts: 0,
        inventoryRetryBaseDelayMs: 1,
      }),
    });

    class HangingCOS {
      getService() {
        return undefined;
      }
    }

    (service as unknown as { loadCosSdk: jest.Mock }).loadCosSdk = jest
      .fn()
      .mockResolvedValue(HangingCOS);

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'tencent-cos',
      region: 'ap-shanghai',
      credential,
      environment,
    });

    expect(result).toMatchObject({
      syncMode: 'cloud_inventory_stub_fallback',
      live: false,
      requestPolicy: {
        timeoutMs: 5,
        retryAttempts: 0,
        retryBaseDelayMs: 1,
        attempts: 1,
        retries: 0,
      },
    });
    expect(result.fallbackReason).toContain('Tencent COS ListBuckets timed out after 5ms');
  });

  it('lists Aliyun RDS instances through POP SDK when live inventory is enabled', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
      return fallback;
    });
    prisma.teamCredential.findFirst.mockResolvedValue({
      config: encryptCredential({
        accessKeyId: 'access-key-id',
        accessKeySecret: 'access-key-secret',
        securityToken: 'sts-token',
        defaultRegion: 'cn-shanghai',
        rdsEndpoint: 'https://rds.aliyuncs.com',
      }),
    });

    class FakeRdsClient {
      static options: Record<string, unknown> | null = null;
      static requests: Array<{
        action: string;
        params: Record<string, unknown>;
        options?: Record<string, unknown>;
      }> = [];

      constructor(options: Record<string, unknown>) {
        FakeRdsClient.options = options;
      }

      async request(action: string, params: Record<string, unknown>, options?: Record<string, unknown>) {
        FakeRdsClient.requests.push({ action, params, options });
        return {
          TotalRecordCount: 1,
          Items: {
            DBInstance: [{
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
          },
        };
      }
    }

    (service as unknown as { loadAliyunRdsSdk: jest.Mock }).loadAliyunRdsSdk = jest
      .fn()
      .mockResolvedValue(FakeRdsClient);

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'aliyun-rds',
      region: 'cn-hangzhou',
      credential: aliyunCredential,
      environment,
    });

    expect(FakeRdsClient.options).toEqual({
      endpoint: 'https://rds.aliyuncs.com',
      apiVersion: '2014-08-15',
      accessKeyId: 'access-key-id',
      accessKeySecret: 'access-key-secret',
      securityToken: 'sts-token',
    });
    expect(FakeRdsClient.requests).toEqual([{
      action: 'DescribeDBInstances',
      params: {
        RegionId: 'cn-shanghai',
        PageNumber: 1,
        PageSize: 100,
      },
      options: { method: 'POST' },
    }]);
    expect(result).toMatchObject({
      provider: 'aliyun-rds',
      syncMode: 'cloud_sdk_live',
      live: true,
      sdk: '@alicloud/pop-core',
      parsedCount: 1,
      skippedCount: 0,
    });
    expect(result.seeds[0]).toMatchObject({
      provider: 'aliyun-rds',
      kind: 'database',
      name: 'orders-prod',
      externalId: 'aliyun-rds:cn-shanghai:rm-123',
      endpoint: 'rm-123.mysql.rds.aliyuncs.com:3306',
      credentialId: 'credential-aliyun',
      projectId: 'project-1',
      environmentId: 'env-prod',
      metadata: {
        syncMode: 'cloud_sdk_live',
        region: 'cn-shanghai',
        engine: 'MySQL',
        engineVersion: '8.0',
        instanceId: 'rm-123',
      },
    });
  });

  it('lists Aliyun SLS projects and logstores through SLS SDK when live inventory is enabled', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
      return fallback;
    });
    prisma.teamCredential.findFirst.mockResolvedValue({
      config: encryptCredential({
        accessKeyId: 'access-key-id',
        accessKeySecret: 'access-key-secret',
        defaultRegion: 'cn-shanghai',
        slsEndpoint: 'cn-shanghai.log.aliyuncs.com',
      }),
    });

    class FakeListProjectRequest {
      constructor(public readonly options: Record<string, unknown>) {}
    }
    class FakeListLogStoresRequest {
      constructor(public readonly options: Record<string, unknown>) {}
    }
    class FakeSlsClient {
      static options: Record<string, unknown> | null = null;
      static projectRequests: unknown[] = [];
      static logstoreRequests: Array<{ project: string; request: unknown }> = [];

      constructor(options: Record<string, unknown>) {
        FakeSlsClient.options = options;
      }

      async listProject(request: unknown) {
        FakeSlsClient.projectRequests.push(request);
        return {
          body: {
            total: 1,
            projects: [{
              projectName: 'prod-logs',
              region: 'cn-shanghai',
              status: 'Normal',
              description: 'production logs',
              resourceGroupId: 'rg-1',
              createTime: '2026-06-26 00:00:00',
            }],
          },
        };
      }

      async listLogStores(project: string, request: unknown) {
        FakeSlsClient.logstoreRequests.push({ project, request });
        return {
          body: {
            total: 2,
            logstores: ['api', 'worker'],
          },
        };
      }
    }

    (service as unknown as { loadAliyunSlsSdk: jest.Mock }).loadAliyunSlsSdk = jest
      .fn()
      .mockResolvedValue({
        Client: FakeSlsClient,
        ListProjectRequest: FakeListProjectRequest,
        ListLogStoresRequest: FakeListLogStoresRequest,
      });

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'aliyun-sls',
      region: 'cn-hangzhou',
      credential: aliyunCredential,
      environment,
    });

    expect(FakeSlsClient.options).toEqual({
      accessKeyId: 'access-key-id',
      accessKeySecret: 'access-key-secret',
      securityToken: undefined,
      regionId: 'cn-shanghai',
      endpoint: 'cn-shanghai.log.aliyuncs.com',
    });
    expect(FakeSlsClient.projectRequests).toHaveLength(1);
    expect(FakeSlsClient.logstoreRequests).toHaveLength(1);
    expect(FakeSlsClient.logstoreRequests[0].project).toBe('prod-logs');
    expect(result).toMatchObject({
      provider: 'aliyun-sls',
      syncMode: 'cloud_sdk_live',
      live: true,
      sdk: '@alicloud/sls20201230',
      parsedCount: 1,
      skippedCount: 0,
    });
    expect(result.seeds[0]).toMatchObject({
      provider: 'aliyun-sls',
      kind: 'log_service',
      name: 'prod-logs',
      externalId: 'aliyun-sls:cn-shanghai:prod-logs',
      endpoint: 'cn-shanghai.log.aliyuncs.com',
      credentialId: 'credential-aliyun',
      config: {
        project: 'prod-logs',
        logstores: ['api', 'worker'],
      },
    });
  });

  it('retries transient Aliyun provider errors and records request policy metadata', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
      return fallback;
    });
    prisma.teamCredential.findFirst.mockResolvedValue({
      config: encryptCredential({
        accessKeyId: 'access-key-id',
        accessKeySecret: 'access-key-secret',
        defaultRegion: 'cn-hangzhou',
        inventoryRetryAttempts: 1,
        inventoryRetryBaseDelayMs: 1,
      }),
    });

    class FlakyRdsClient {
      static calls = 0;

      async request() {
        FlakyRdsClient.calls += 1;
        if (FlakyRdsClient.calls === 1) {
          throw { message: 'Throttling.User' };
        }
        return {
          TotalRecordCount: 1,
          Items: {
            DBInstance: [{
              DBInstanceId: 'rm-retry',
              DBInstanceStatus: 'Running',
              Engine: 'MySQL',
            }],
          },
        };
      }
    }

    (service as unknown as { loadAliyunRdsSdk: jest.Mock }).loadAliyunRdsSdk = jest
      .fn()
      .mockResolvedValue(FlakyRdsClient);

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'aliyun-rds',
      region: 'cn-hangzhou',
      credential: aliyunCredential,
      environment,
    });

    expect(FlakyRdsClient.calls).toBe(2);
    expect(result).toMatchObject({
      syncMode: 'cloud_sdk_live',
      live: true,
      regions: ['cn-hangzhou'],
      requestPolicy: {
        retryAttempts: 1,
        retryBaseDelayMs: 1,
        attempts: 2,
        retries: 1,
      },
    });
    expect(result.seeds[0].externalId).toBe('aliyun-rds:cn-hangzhou:rm-retry');
  });

  it('reads Aliyun inventory across configured regions when no request region is explicit', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
      return fallback;
    });
    prisma.teamCredential.findFirst.mockResolvedValue({
      config: encryptCredential({
        accessKeyId: 'access-key-id',
        accessKeySecret: 'access-key-secret',
        inventoryRegions: ['cn-hangzhou', 'cn-shanghai'],
        inventoryRetryAttempts: 0,
      }),
    });

    class RegionalRdsClient {
      static regions: string[] = [];

      async request(_action: string, params: Record<string, unknown>) {
        const region = String(params.RegionId);
        RegionalRdsClient.regions.push(region);
        return {
          TotalRecordCount: 1,
          Items: {
            DBInstance: [{
              DBInstanceId: `rm-${region}`,
              DBInstanceStatus: 'Running',
              Engine: 'MySQL',
            }],
          },
        };
      }
    }

    (service as unknown as { loadAliyunRdsSdk: jest.Mock }).loadAliyunRdsSdk = jest
      .fn()
      .mockResolvedValue(RegionalRdsClient);

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'aliyun-rds',
      region: 'cn-hangzhou',
      credential: aliyunCredential,
      environment,
    });

    expect(RegionalRdsClient.regions).toEqual(['cn-hangzhou', 'cn-shanghai']);
    expect(result.regions).toEqual(['cn-hangzhou', 'cn-shanghai']);
    expect(result.seeds.map((seed) => seed.externalId)).toEqual([
      'aliyun-rds:cn-hangzhou:rm-cn-hangzhou',
      'aliyun-rds:cn-shanghai:rm-cn-shanghai',
    ]);
  });

  it('records Aliyun provider SDK errors as fallback metadata', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED') return 'true';
      if (key === 'ENCRYPTION_KEY') return 'test-cloud-inventory-key';
      return fallback;
    });
    prisma.teamCredential.findFirst.mockResolvedValue({
      config: encryptCredential({
        accessKeyId: 'access-key-id',
        accessKeySecret: 'access-key-secret',
      }),
    });

    class FailingRdsClient {
      async request() {
        throw { message: 'InvalidAccessKeyId.NotFound' };
      }
    }

    (service as unknown as { loadAliyunRdsSdk: jest.Mock }).loadAliyunRdsSdk = jest
      .fn()
      .mockResolvedValue(FailingRdsClient);

    const result = await service.collect({
      teamId: 'team-1',
      provider: 'aliyun-rds',
      region: 'cn-hangzhou',
      credential: aliyunCredential,
      environment,
    });

    expect(result).toMatchObject({
      syncMode: 'cloud_inventory_stub_fallback',
      live: false,
    });
    expect(result.fallbackReason).toContain('Aliyun RDS live inventory failed: InvalidAccessKeyId.NotFound');
  });
});

const credentialCrypto = createTestCryptoService('test-cloud-inventory-key');

function encryptCredential(payload: Record<string, unknown>) {
  return credentialCrypto.encryptGcm(JSON.stringify(payload));
}
