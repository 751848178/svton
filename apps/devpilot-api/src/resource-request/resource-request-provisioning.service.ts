/**
 * Resource provisioning orchestration service.
 *
 * Owns the provisioning *dispatch surface*: `runApprovedProvisioningProcessor`
 * (mode router), resource-type / credential-ref resolution, retry/replay
 * gating, and the HTTP-adapter feature-flag readers. The four concrete
 * adapters (pool / script / http / provider) live in focused sibling services
 * that this orchestrator delegates to, so every file stays under the 200-line
 * ceiling.
 *
 * Extracted from `ResourceRequestService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceRequestCredentialRefService } from './resource-request-credential-ref.service';
import { ResourceRequestPoolProvisioningService } from './resource-request-pool-provisioning.service';
import { ResourceRequestScriptProvisioningService } from './resource-request-script-provisioning.service';
import { ResourceRequestHttpProvisioningService } from './resource-request-http-provisioning.service';
import { ResourceRequestProviderProvisioningService } from './resource-request-provider-provisioning.service';
import {
  AuditInput,
  JsonRecord,
  ProvisioningCredentialRef,
  ProvisioningProcessorContext,
} from './resource-request.types';
import { normalizeProvisioningMode } from './resource-provisioning-script.utils';
import {
  asRecord,
  readBoolean,
  readString,
} from './resource-provisioning-value.utils';
import {
  resolveAuthAdapterKey,
  readCredentialTypeAllowList,
} from './resource-provisioning-http-config.utils';

@Injectable()
export class ResourceRequestProvisioningService {
  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly credentialRef: ResourceRequestCredentialRefService,
    private readonly poolAdapter: ResourceRequestPoolProvisioningService,
    private readonly scriptAdapter: ResourceRequestScriptProvisioningService,
    private readonly httpAdapter: ResourceRequestHttpProvisioningService,
    private readonly providerAdapter: ResourceRequestProviderProvisioningService,
    private readonly configService: ConfigService,
  ) {}

  resolveProvisioningCredentialRef(teamId: string, config: JsonRecord) {
    return this.credentialRef.resolveProvisioningCredentialRef(teamId, config);
  }

  async runApprovedProvisioningProcessor(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    context: ProvisioningProcessorContext,
  ) {
    const resourceType = await this.getProvisioningResourceType(request.resourceTypeId as string);
    const mode = normalizeProvisioningMode(resourceType.provisioningMode);

    if (mode === 'manual' || mode === 'credential_only') {
      return request;
    }
    if (mode === 'pool') {
      return this.poolAdapter.provisionFromPool(teamId, userId as string, request, resourceType);
    }
    if (mode === 'script') {
      return this.scriptAdapter.provisionWithScript(teamId, userId as string, request, resourceType);
    }
    if (mode === 'provider') {
      return this.providerAdapter.provisionWithProviderAdapter(teamId, userId, request, resourceType, context);
    }
    return this.httpAdapter.provisionWithHttpAdapter(teamId, userId, request, resourceType, mode, context);
  }

  async getProvisioningResourceType(resourceTypeId: string) {
    const resourceType = await this.repo.findResourceTypeByUnique({
      where: { id: resourceTypeId },
      select: {
        id: true,
        key: true,
        name: true,
        provisioningMode: true,
        provisioningConfig: true,
        deliverySchema: true,
      },
    });

    if (!resourceType) {
      throw new NotFoundException('资源类型不存在');
    }

    return resourceType;
  }

  async retryProvisioningRecord(
    teamId: string,
    userId: string | undefined,
    existing: JsonRecord,
    context: ProvisioningProcessorContext,
  ) {
    if (existing.status !== 'approved') {
      throw new BadRequestException('只有已审批且未交付的申请可以重试交付处理器');
    }

    const previousProvisioning = asRecord(asRecord(existing.result).provisioning);
    const previousStatus = readString(previousProvisioning.status);
    const retryableStatuses = context.trigger === 'auto_retry' ? ['blocked'] : ['blocked', 'planned', 'failed'];
    if (!retryableStatuses.includes(previousStatus)) {
      throw new BadRequestException('只有已阻断、已生成计划或失败的交付处理器可以重试');
    }

    const resourceType = await this.getProvisioningResourceType(existing.resourceTypeId as string);
    const mode = normalizeProvisioningMode(resourceType.provisioningMode);
    if (mode === 'manual' || mode === 'credential_only') {
      throw new BadRequestException('人工交付或纯凭据资源不需要重试交付处理器');
    }
    const isReplay = Boolean(context.replayOfRunId);
    const auditInput: AuditInput = {
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId as string,
      requestId: existing.id as string,
      provisioningRunId: context.replayOfRunId,
      action: context.trigger === 'auto_retry'
        ? 'provisioning.auto_retry_requested'
        : isReplay
          ? 'provisioning.run_replay_requested'
          : 'provisioning.retry_requested',
      message: context.trigger === 'auto_retry'
        ? '自动补偿重新触发资源交付处理器'
        : isReplay
          ? '重放资源交付运行'
          : '重新触发资源交付处理器',
      metadata: {
        mode,
        previousStatus,
        previousBoundary: previousProvisioning.boundary,
        previousReason: previousProvisioning.reason,
        previousIdempotencyKey: previousProvisioning.idempotencyKey,
        trigger: context.trigger,
        replayOfRunId: context.replayOfRunId,
        replaySourceStatus: context.replaySourceStatus,
        retryRequestedAt: new Date().toISOString(),
      },
    };

    if (context.trigger === 'auto_retry') {
      if (mode !== 'api' && mode !== 'webhook') {
        throw new BadRequestException('自动补偿只支持 HTTP 外部交付处理器');
      }
      await this.statusWriter.writeAudit(auditInput);
      return this.httpAdapter.provisionWithHttpAdapter(teamId, userId, existing, resourceType, mode, context);
    }

    await this.statusWriter.writeAudit(auditInput);
    return this.runApprovedProvisioningProcessor(teamId, userId as string, existing, context);
  }

  httpProvisioningEnabled() {
    return readBoolean(this.configService.get('RESOURCE_PROVISIONING_HTTP_ENABLED', false), false);
  }

  httpProvisioningQueueEnabled() {
    return readBoolean(
      this.configService.get('RESOURCE_REQUEST_PROVISIONING_HTTP_QUEUE_ENABLED', false),
      false,
    );
  }
}
