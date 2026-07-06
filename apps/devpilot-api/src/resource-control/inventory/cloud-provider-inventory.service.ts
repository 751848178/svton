import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import {
  ProviderRequestPolicy,
  executeProviderCall,
  providerErrorMessage,
} from '../../common/retry/provider-retry';
import {
  buildCloudInventorySeedsFromProviderPayload,
  buildFallbackCloudInventorySeeds,
  CloudInventoryEnvironment,
  CloudInventoryProvider,
  CloudInventoryResourceSeed,
} from './cloud-inventory';

type TeamCredentialRecord = {
  id: string;
  name: string;
  type: string;
};

type CloudInventoryCollectInput = {
  teamId: string;
  provider: CloudInventoryProvider;
  region: string;
  regionExplicit?: boolean;
  credential?: TeamCredentialRecord | null;
  environment?: CloudInventoryEnvironment | null;
};

type CloudInventoryRuntimeConfig = {
  inventoryRegions?: string[] | string;
  regions?: string[] | string;
  inventoryRetryAttempts?: number | string;
  inventoryRetryBaseDelayMs?: number | string;
  inventoryTimeoutMs?: number | string;
};

type TencentCredentialConfig = {
  secretId?: string;
  secretKey?: string;
  defaultRegion?: string;
  appId?: string;
} & CloudInventoryRuntimeConfig;

type AliyunCredentialConfig = {
  accessKeyId?: string;
  accessKeySecret?: string;
  securityToken?: string;
  defaultRegion?: string;
  accountId?: string;
  rdsEndpoint?: string;
  slsEndpoint?: string;
  inventoryPageSize?: number | string;
  inventoryMaxPages?: number | string;
} & CloudInventoryRuntimeConfig;

type CosListBucketsResult = {
  Buckets?: Array<Record<string, unknown>>;
};

type RdsRpcClientConstructor = new (options: Record<string, unknown>) => {
  request<T>(action: string, params: Record<string, unknown>, options?: Record<string, unknown>): Promise<T>;
};

type AliyunSlsSdk = {
  Client: new (options: Record<string, unknown>) => {
    listProject(request: unknown): Promise<unknown>;
    listLogStores(project: string, request: unknown): Promise<unknown>;
  };
  ListProjectRequest: new (options: Record<string, unknown>) => unknown;
  ListLogStoresRequest: new (options: Record<string, unknown>) => unknown;
};


export type CloudProviderInventoryResult = {
  provider: CloudInventoryProvider;
  syncMode: 'cloud_sdk_live' | 'cloud_inventory_stub_fallback';
  seeds: CloudInventoryResourceSeed[];
  parsedCount: number;
  skippedCount: number;
  errors: string[];
  live: boolean;
  sdk?: string;
  fallbackReason?: string;
  regions?: string[];
  requestPolicy?: Record<string, unknown>;
};

@Injectable()
export class CloudProviderInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  async collect(input: CloudInventoryCollectInput): Promise<CloudProviderInventoryResult> {
    if (!this.liveInventoryEnabled()) {
      return this.fallback(input, 'Cloud provider live inventory is disabled');
    }

    if (!input.credential) {
      return this.fallback(input, 'Cloud provider live inventory requires a TeamCredential binding');
    }

    if (input.provider === 'tencent-cos') {
      return this.collectTencentCos(input);
    }
    if (input.provider === 'aliyun-rds') {
      return this.collectAliyunRds(input);
    }
    if (input.provider === 'aliyun-sls') {
      return this.collectAliyunSls(input);
    }

    return this.fallback(input, `${input.provider} live inventory SDK transport is not implemented yet`);
  }

  private async collectTencentCos(input: CloudInventoryCollectInput): Promise<CloudProviderInventoryResult> {
    if (input.credential?.type !== 'cloud_tencent') {
      return this.fallback(input, 'Tencent COS inventory requires a cloud_tencent TeamCredential');
    }

    let requestPolicy: ProviderRequestPolicy | undefined;
    try {
      const credentialConfig = await this.getCredentialConfig<TencentCredentialConfig>(
        input.teamId,
        input.credential.id,
      );
      const secretId = this.asString(credentialConfig.secretId);
      const secretKey = this.asString(credentialConfig.secretKey);
      requestPolicy = this.createProviderRequestPolicy(credentialConfig);

      if (!secretId || !secretKey) {
        return this.fallback(input, 'Tencent COS credential is missing secretId or secretKey');
      }

      const COS = await this.loadCosSdk();
      if (!COS) {
        return this.fallback(input, 'cos-nodejs-sdk-v5 is not available to Devpilot API');
      }

      const cos = new COS({
        SecretId: secretId,
        SecretKey: secretKey,
      });
      const payload = await executeProviderCall(
        requestPolicy,
        'Tencent COS ListBuckets',
        () => this.listTencentBuckets(cos),
      );
      const mapped = buildCloudInventorySeedsFromProviderPayload(payload, {
        provider: input.provider,
        region: this.asString(credentialConfig.defaultRegion) || input.region,
        credentialId: input.credential.id,
        environment: input.environment,
        syncMode: 'cloud_sdk_live',
      });

      return {
        provider: input.provider,
        syncMode: 'cloud_sdk_live',
        seeds: mapped.seeds,
        parsedCount: mapped.parsedCount,
        skippedCount: mapped.skippedCount,
        errors: mapped.errors,
        live: true,
        sdk: 'cos-nodejs-sdk-v5',
        requestPolicy: this.summarizeRequestPolicy(requestPolicy),
      };
    } catch (error) {
      return this.fallback(
        input,
        `Tencent COS live inventory failed: ${providerErrorMessage(error)}`,
        {
          requestPolicy: requestPolicy ? this.summarizeRequestPolicy(requestPolicy) : undefined,
        },
      );
    }
  }

  private async collectAliyunRds(input: CloudInventoryCollectInput): Promise<CloudProviderInventoryResult> {
    if (input.credential?.type !== 'cloud_aliyun') {
      return this.fallback(input, 'Aliyun RDS inventory requires a cloud_aliyun TeamCredential');
    }

    let requestPolicy: ProviderRequestPolicy | undefined;
    let regions: string[] | undefined;
    try {
      const credentialConfig = await this.getCredentialConfig<AliyunCredentialConfig>(
        input.teamId,
        input.credential.id,
      );
      const aliyunCredential = this.resolveAliyunCredential(input, credentialConfig);
      if (!aliyunCredential) {
        return this.fallback(input, 'Aliyun credential is missing accessKeyId or accessKeySecret');
      }

      const RPCClient = await this.loadAliyunRdsSdk();
      if (!RPCClient) {
        return this.fallback(input, '@alicloud/pop-core is not available to Devpilot API');
      }

      const pageSize = this.resolveInventoryPageSize(credentialConfig, 100);
      const maxPages = this.resolveInventoryMaxPages(credentialConfig, 20);
      regions = this.resolveAliyunRegions(input, credentialConfig);
      requestPolicy = this.createProviderRequestPolicy(credentialConfig);
      const client = new RPCClient({
        endpoint: this.asString(credentialConfig.rdsEndpoint) || 'https://rds.aliyuncs.com',
        apiVersion: '2014-08-15',
        accessKeyId: aliyunCredential.accessKeyId,
        accessKeySecret: aliyunCredential.accessKeySecret,
        securityToken: aliyunCredential.securityToken,
      });
      const mapped = this.emptyCloudInventoryResult();

      for (const region of regions) {
        const instances: Array<Record<string, unknown>> = [];

        for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
          const response = await executeProviderCall(
            requestPolicy,
            `Aliyun RDS DescribeDBInstances ${region} page ${pageNumber}`,
            () => client.request<Record<string, unknown>>('DescribeDBInstances', {
              RegionId: region,
              PageNumber: pageNumber,
              PageSize: pageSize,
            }, { method: 'POST' }),
          );
          const pageItems = this.readAliyunRdsInstances(response);
          instances.push(...pageItems);

          const total = this.asPositiveInt(this.readFirstValue(response, ['TotalRecordCount', 'totalRecordCount']), 0);
          if (!pageItems.length || pageItems.length < pageSize || (total > 0 && pageNumber * pageSize >= total)) {
            break;
          }
        }

        this.mergeCloudInventoryResult(mapped, buildCloudInventorySeedsFromProviderPayload({ DBInstances: instances }, {
          provider: input.provider,
          region,
          credentialId: input.credential.id,
          environment: input.environment,
          syncMode: 'cloud_sdk_live',
        }));
      }

      return {
        provider: input.provider,
        syncMode: 'cloud_sdk_live',
        seeds: mapped.seeds,
        parsedCount: mapped.parsedCount,
        skippedCount: mapped.skippedCount,
        errors: mapped.errors,
        live: true,
        sdk: '@alicloud/pop-core',
        regions,
        requestPolicy: this.summarizeRequestPolicy(requestPolicy),
      };
    } catch (error) {
      return this.fallback(
        input,
        `Aliyun RDS live inventory failed: ${providerErrorMessage(error)}`,
        {
          regions,
          requestPolicy: requestPolicy ? this.summarizeRequestPolicy(requestPolicy) : undefined,
        },
      );
    }
  }

  private async collectAliyunSls(input: CloudInventoryCollectInput): Promise<CloudProviderInventoryResult> {
    if (input.credential?.type !== 'cloud_aliyun') {
      return this.fallback(input, 'Aliyun SLS inventory requires a cloud_aliyun TeamCredential');
    }

    let requestPolicy: ProviderRequestPolicy | undefined;
    let regions: string[] | undefined;
    try {
      const credentialConfig = await this.getCredentialConfig<AliyunCredentialConfig>(
        input.teamId,
        input.credential.id,
      );
      const aliyunCredential = this.resolveAliyunCredential(input, credentialConfig);
      if (!aliyunCredential) {
        return this.fallback(input, 'Aliyun credential is missing accessKeyId or accessKeySecret');
      }

      const slsSdk = await this.loadAliyunSlsSdk();
      if (!slsSdk) {
        return this.fallback(input, '@alicloud/sls20201230 is not available to Devpilot API');
      }

      const pageSize = this.resolveInventoryPageSize(credentialConfig, 100);
      const maxPages = this.resolveInventoryMaxPages(credentialConfig, 20);
      regions = this.resolveAliyunRegions(input, credentialConfig);
      requestPolicy = this.createProviderRequestPolicy(credentialConfig);
      const mapped = this.emptyCloudInventoryResult();
      const activeRequestPolicy = requestPolicy;

      for (const region of regions) {
        const endpoint = this.resolveAliyunSlsEndpoint(credentialConfig, region, regions.length);
        const client = new slsSdk.Client({
          accessKeyId: aliyunCredential.accessKeyId,
          accessKeySecret: aliyunCredential.accessKeySecret,
          securityToken: aliyunCredential.securityToken,
          regionId: region,
          endpoint,
        });
        const projects: Array<Record<string, unknown>> = [];

        for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
          const response = await executeProviderCall(
            requestPolicy,
            `Aliyun SLS ListProject ${region} page ${pageNumber + 1}`,
            () => client.listProject(new slsSdk.ListProjectRequest({
              offset: pageNumber * pageSize,
              size: pageSize,
              fetchQuota: false,
            })),
          );
          const pageProjects = this.readAliyunSlsProjects(response, region);
          projects.push(...pageProjects);

          const body = this.asRecord(this.asRecord(response).body);
          const total = this.asPositiveInt(body.total, 0);
          if (!pageProjects.length || pageProjects.length < pageSize || (total > 0 && projects.length >= total)) {
            break;
          }
        }

        const projectRecords = await Promise.all(projects.map(async (project) => {
          const projectName = this.asString(project.projectName) || this.asString(project.name);
          if (!projectName) return null;
          const logstores = await this.collectAliyunSlsLogstores(
            client,
            slsSdk,
            projectName,
            pageSize,
            maxPages,
            activeRequestPolicy,
          );

          return {
            projectName,
            endpoint,
            status: this.asString(project.status) || 'Normal',
            description: this.asString(project.description),
            region: this.asString(project.region) || region,
            logstores,
            resourceGroupId: this.asString(project.resourceGroupId),
            createTime: this.asString(project.createTime),
            lastModifyTime: this.asString(project.lastModifyTime),
          };
        }));

        this.mergeCloudInventoryResult(mapped, buildCloudInventorySeedsFromProviderPayload({
          projects: projectRecords.filter(Boolean) as Array<Record<string, unknown>>,
        }, {
          provider: input.provider,
          region,
          credentialId: input.credential.id,
          environment: input.environment,
          syncMode: 'cloud_sdk_live',
        }));
      }

      return {
        provider: input.provider,
        syncMode: 'cloud_sdk_live',
        seeds: mapped.seeds,
        parsedCount: mapped.parsedCount,
        skippedCount: mapped.skippedCount,
        errors: mapped.errors,
        live: true,
        sdk: '@alicloud/sls20201230',
        regions,
        requestPolicy: this.summarizeRequestPolicy(requestPolicy),
      };
    } catch (error) {
      return this.fallback(
        input,
        `Aliyun SLS live inventory failed: ${providerErrorMessage(error)}`,
        {
          regions,
          requestPolicy: requestPolicy ? this.summarizeRequestPolicy(requestPolicy) : undefined,
        },
      );
    }
  }

  private fallback(
    input: CloudInventoryCollectInput,
    reason: string,
    details?: Pick<CloudProviderInventoryResult, 'regions' | 'requestPolicy'>,
  ): CloudProviderInventoryResult {
    const fallback = buildFallbackCloudInventorySeeds({
      provider: input.provider,
      region: input.region,
      credentialId: input.credential?.id,
      environment: input.environment,
      syncMode: 'cloud_inventory_stub_fallback',
    });

    return {
      provider: input.provider,
      syncMode: 'cloud_inventory_stub_fallback',
      seeds: fallback.seeds,
      parsedCount: fallback.parsedCount,
      skippedCount: fallback.skippedCount,
      errors: fallback.errors,
      fallbackReason: reason,
      live: false,
      regions: details?.regions,
      requestPolicy: details?.requestPolicy,
    };
  }

  private async getCredentialConfig<T extends Record<string, unknown>>(
    teamId: string,
    credentialId: string,
  ): Promise<T> {
    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: credentialId, teamId },
      select: { config: true },
    });

    if (!credential) {
      return {} as T;
    }

    try {
      return JSON.parse(this.decrypt(credential.config)) as T;
    } catch (error) {
      if (credential.config.trim().startsWith('{')) {
        return JSON.parse(credential.config) as T;
      }
      throw error;
    }
  }

  private decrypt(text: string) {
    return this.cryptoService.decryptGcm(text);
  }

  private liveInventoryEnabled() {
    return this.configService.get('RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED', 'false') === 'true';
  }

  private async loadCosSdk() {
    try {
      const mod = await import('cos-nodejs-sdk-v5');
      return (mod.default || mod) as new (options: Record<string, unknown>) => {
        getService(callback: (error: unknown, data: CosListBucketsResult) => void): void;
      };
    } catch {
      return null;
    }
  }

  private async loadAliyunRdsSdk(): Promise<RdsRpcClientConstructor | null> {
    try {
      const mod = await import('@alicloud/pop-core');
      return (mod.default || mod) as unknown as RdsRpcClientConstructor;
    } catch {
      return null;
    }
  }

  private async loadAliyunSlsSdk(): Promise<AliyunSlsSdk | null> {
    try {
      const mod = await import('@alicloud/sls20201230');
      const moduleRecord = mod as unknown as Record<string, unknown>;
      return {
        Client: (moduleRecord.default || mod) as AliyunSlsSdk['Client'],
        ListProjectRequest: moduleRecord.ListProjectRequest as AliyunSlsSdk['ListProjectRequest'],
        ListLogStoresRequest: moduleRecord.ListLogStoresRequest as AliyunSlsSdk['ListLogStoresRequest'],
      };
    } catch {
      return null;
    }
  }

  private listTencentBuckets(cos: {
    getService(callback: (error: unknown, data: CosListBucketsResult) => void): void;
  }) {
    return new Promise<CosListBucketsResult>((resolve, reject) => {
      cos.getService((error, data) => {
        if (error) {
          reject(new Error(providerErrorMessage(error)));
          return;
        }
        resolve(data || { Buckets: [] });
      });
    });
  }

  private resolveAliyunCredential(
    input: CloudInventoryCollectInput,
    credentialConfig: AliyunCredentialConfig,
  ) {
    const accessKeyId = this.asString(credentialConfig.accessKeyId);
    const accessKeySecret = this.asString(credentialConfig.accessKeySecret);
    if (!accessKeyId || !accessKeySecret) {
      return null;
    }

    return {
      accessKeyId,
      accessKeySecret,
      securityToken: this.asString(credentialConfig.securityToken),
      region: this.resolveAliyunRegions(input, credentialConfig)[0],
    };
  }

  private resolveAliyunRegions(
    input: CloudInventoryCollectInput,
    credentialConfig: AliyunCredentialConfig,
  ) {
    if (input.regionExplicit) {
      return [input.region];
    }

    const configuredRegions = this.readStringList(credentialConfig.inventoryRegions)
      || this.readStringList(credentialConfig.regions);
    const regions = configuredRegions?.length
      ? configuredRegions
      : [this.asString(credentialConfig.defaultRegion) || input.region];

    return Array.from(new Set(regions.map((region) => region.trim()).filter(Boolean)));
  }

  private resolveAliyunSlsEndpoint(
    credentialConfig: AliyunCredentialConfig,
    region: string,
    regionCount: number,
  ) {
    const configuredEndpoint = this.asString(credentialConfig.slsEndpoint);
    if (configuredEndpoint && regionCount === 1) {
      return configuredEndpoint;
    }
    return `${region}.log.aliyuncs.com`;
  }

  private readAliyunRdsInstances(response: unknown) {
    const record = this.asRecord(response);
    const direct = this.readRecordArray(record.DBInstances)
      || this.readRecordArray(record.DBInstance)
      || this.readRecordArray(record.Items);
    if (direct) return direct;

    const items = this.asRecord(record.Items);
    return this.readRecordArray(items.DBInstance)
      || this.readRecordArray(items.DBInstances)
      || [];
  }

  private readAliyunSlsProjects(response: unknown, region: string) {
    const body = this.asRecord(this.asRecord(response).body);
    const projects = this.readRecordArray(body.projects) || [];
    return projects.filter((project) => {
      const projectRegion = this.asString(project.region);
      return !projectRegion || projectRegion === region;
    });
  }

  private async collectAliyunSlsLogstores(
    client: {
      listLogStores(project: string, request: unknown): Promise<unknown>;
    },
    slsSdk: AliyunSlsSdk,
    projectName: string,
    pageSize: number,
    maxPages: number,
    requestPolicy: ProviderRequestPolicy,
  ) {
    const logstores: string[] = [];

    for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
      const response = await executeProviderCall(
        requestPolicy,
        `Aliyun SLS ListLogStores ${projectName} page ${pageNumber + 1}`,
        () => client.listLogStores(projectName, new slsSdk.ListLogStoresRequest({
          offset: pageNumber * pageSize,
          size: pageSize,
        })),
      );
      const body = this.asRecord(this.asRecord(response).body);
      const names = this.readStringArray(body.logstores);
      logstores.push(...names);

      const total = this.asPositiveInt(body.total, 0);
      if (!names.length || names.length < pageSize || (total > 0 && logstores.length >= total)) {
        break;
      }
    }

    return logstores;
  }

  private resolveInventoryPageSize(config: AliyunCredentialConfig, fallback: number) {
    return this.asPositiveInt(config.inventoryPageSize, fallback, 500);
  }

  private resolveInventoryMaxPages(config: AliyunCredentialConfig, fallback: number) {
    return this.asPositiveInt(config.inventoryMaxPages, fallback, 100);
  }

  private createProviderRequestPolicy(config: CloudInventoryRuntimeConfig): ProviderRequestPolicy {
    return {
      timeoutMs: this.asPositiveInt(
        config.inventoryTimeoutMs ?? this.configService.get('RESOURCE_CONTROL_CLOUD_INVENTORY_TIMEOUT_MS', '10000'),
        10000,
        120000,
      ),
      retryAttempts: this.asNonNegativeInt(
        config.inventoryRetryAttempts
          ?? this.configService.get('RESOURCE_CONTROL_CLOUD_INVENTORY_RETRY_ATTEMPTS', '1'),
        1,
        5,
      ),
      retryBaseDelayMs: this.asPositiveInt(
        config.inventoryRetryBaseDelayMs
          ?? this.configService.get('RESOURCE_CONTROL_CLOUD_INVENTORY_RETRY_BASE_DELAY_MS', '200'),
        200,
        10000,
      ),
      attempts: 0,
      retries: 0,
    };
  }

  private summarizeRequestPolicy(policy: ProviderRequestPolicy) {
    return {
      timeoutMs: policy.timeoutMs,
      retryAttempts: policy.retryAttempts,
      retryBaseDelayMs: policy.retryBaseDelayMs,
      attempts: policy.attempts,
      retries: policy.retries,
    };
  }

  private emptyCloudInventoryResult() {
    return {
      seeds: [] as CloudInventoryResourceSeed[],
      parsedCount: 0,
      skippedCount: 0,
      errors: [] as string[],
    };
  }

  private mergeCloudInventoryResult(
    target: {
      seeds: CloudInventoryResourceSeed[];
      parsedCount: number;
      skippedCount: number;
      errors: string[];
    },
    source: {
      seeds: CloudInventoryResourceSeed[];
      parsedCount: number;
      skippedCount: number;
      errors: string[];
    },
  ) {
    target.seeds.push(...source.seeds);
    target.parsedCount += source.parsedCount;
    target.skippedCount += source.skippedCount;
    target.errors.push(...source.errors);
  }

  private readFirstValue(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) {
        return record[key];
      }
    }
    return undefined;
  }

  private readRecordArray(value: unknown): Array<Record<string, unknown>> | null {
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => this.isRecord(item));
    }
    if (!this.isRecord(value)) {
      return null;
    }

    for (const nested of Object.values(value)) {
      const nestedArray = this.readRecordArray(nested);
      if (nestedArray) {
        return nestedArray;
      }
    }

    return Object.values(value).every((item) => this.isRecord(item))
      ? Object.values(value) as Array<Record<string, unknown>>
      : null;
  }

  private readStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  private readStringList(value: unknown) {
    if (Array.isArray(value)) {
      const values = value
        .map((item) => this.asString(item))
        .filter((item): item is string => Boolean(item));
      return values.length ? values : null;
    }
    if (typeof value === 'string') {
      const values = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      return values.length ? values : null;
    }
    return null;
  }

  private asPositiveInt(value: unknown, fallback: number, max?: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    const intValue = Math.floor(parsed);
    return max ? Math.min(intValue, max) : intValue;
  }

  private asNonNegativeInt(value: unknown, fallback: number, max?: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    const intValue = Math.floor(parsed);
    return max ? Math.min(intValue, max) : intValue;
  }

  private asString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
