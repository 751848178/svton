import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ExecuteResourceActionInput,
  ResourceActionExecutionResult,
  ResourceExecutor,
} from './executor.types';

@Injectable()
export class CloudSdkExecutor implements ResourceExecutor {
  key = 'cloud-sdk';
  adapterKey = 'cloud-provider-sdk';

  supports(input: ExecuteResourceActionInput) {
    return input.resource.sourceType === 'cloud' && input.credential.transport === 'cloud_sdk';
  }

  async execute(input: ExecuteResourceActionInput): Promise<ResourceActionExecutionResult> {
    const commandPlan = this.buildSdkPlan(input);

    if (!input.dryRun) {
      return {
        status: 'blocked',
        commandPlan,
        error: 'Cloud SDK executor currently returns SDK call plans only; live provider SDK transport is not enabled.',
        result: {
          mode: 'blocked_live_transport',
          nextExecutorBoundary: 'cloud_provider_sdk',
          dryRunOnly: input.action.dryRunOnly,
        },
      };
    }

    return {
      status: 'completed',
      commandPlan,
      result: {
        mode: 'cloud_sdk_plan',
        executed: false,
        executorKey: this.key,
        adapterKey: this.adapterKey,
        credential: input.credential.metadata,
      },
    };
  }

  private buildSdkPlan(input: ExecuteResourceActionInput): Prisma.InputJsonValue {
    return {
      executorKey: this.key,
      adapterKey: this.resolveAdapterKey(input),
      dryRunOnly: input.action.dryRunOnly,
      resource: {
        id: input.resource.id,
        name: input.resource.name,
        provider: input.resource.provider,
        kind: input.resource.kind,
        endpoint: input.resource.endpoint,
      },
      safety: {
        allowlistAction: input.action.key,
        providerSdkOnly: true,
        secretsInOutput: 'must_mask_before_persisting',
      },
      sdkCalls: this.sdkCallsForAction(input),
    };
  }

  private sdkCallsForAction(input: ExecuteResourceActionInput) {
    const config = this.asRecord(input.resource.config);
    const metadata = this.asRecord(input.resource.metadata);
    const region = this.asString(metadata.region) || this.asString(input.params.region) || 'default';

    switch (input.action.key) {
      case 'mysql.connection.test':
        return [
          {
            provider: input.resource.provider,
            operation: input.resource.provider === 'aliyun-rds' ? 'DescribeDBInstanceAttribute' : 'DescribeDatabase',
            params: {
              region,
              instanceId: input.resource.externalId.split(':').pop(),
              endpoint: input.resource.endpoint,
            },
          },
        ];

      case 'mysql.backup.plan':
        return [
          {
            provider: input.resource.provider,
            operation: input.resource.provider === 'aliyun-rds' ? 'CreateBackup' : 'CreateDatabaseBackup',
            params: {
              region,
              instanceId: input.resource.externalId.split(':').pop(),
              backupMethod: 'Logical',
            },
          },
        ];

      case 'sls.logstores.list':
        return [
          {
            provider: 'aliyun-sls',
            operation: 'ListLogStores',
            params: {
              region,
              project: this.asString(config.project) || input.resource.name,
            },
          },
        ];

      case 'cos.objects.list':
        return [
          {
            provider: 'tencent-cos',
            operation: 'GetBucket',
            params: {
              region,
              bucket: this.asString(config.bucket) || input.resource.name,
              prefix: this.asString(input.params.prefix) || '',
              maxKeys: this.asPositiveInt(input.params.limit, 100, 1000),
            },
          },
        ];

      default:
        return [
          {
            provider: input.resource.provider,
            operation: 'UnsupportedAction',
            params: { action: input.action.key },
          },
        ];
    }
  }

  private resolveAdapterKey(input: ExecuteResourceActionInput) {
    if (input.resource.provider === 'aliyun-sls') {
      return 'aliyun-sls-sdk';
    }
    if (input.resource.provider === 'tencent-cos') {
      return 'tencent-cos-sdk';
    }
    if (input.resource.provider === 'aliyun-rds') {
      return 'aliyun-rds-sdk';
    }
    return this.adapterKey;
  }

  private asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private asString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asPositiveInt(value: unknown, fallback: number, max: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(1, Math.min(Math.floor(value), max));
  }
}
