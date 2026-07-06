import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestAccessService } from './resource-request-access.service';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceProvisioningRunWriterService } from './resource-provisioning-run-writer.service';
import { ResourceRequestProvisioningService } from './resource-request-provisioning.service';
import { ResourceRequestRecoveryService } from './resource-request-recovery.service';
import { ResourceProviderStateService } from './resource-provider-state.service';
import { ResourceTypeService } from './resource-type.service';
import { serializeProvisioningRun } from './resource-provisioning-run-serialize.utils';
import { ResourcePoolService } from '../resource-pool/resource-pool.service';
import { ServerExecutorService } from '../server-executor/server-executor.service';
import { ResourceProvisioningRunSupervisorService } from './resource-provisioning-run-supervisor.service';
import { ResourceProvisioningRunReadService } from './resource-provisioning-run-read.service';
import {
  ServerCommandStep,
  ServerExecutionInput,
  ServerExecutionResult,
} from '../server-executor/server-executor.types';
import {
  CompleteResourceRequestDto,
  CreateResourceRequestDto,
  CreateResourceTypeDto,
  ListResourceAuditLogsQueryDto,
  ListResourceInstancesQueryDto,
  ListResourceProvisioningRunsQueryDto,
  ListResourceRequestsQueryDto,
  ProcessQueuedResourceProvisioningRunDto,
  RecoverStaleResourceProvisioningRunsDto,
  ReconcileProviderResourceProvisioningRunDto,
  ResourceProvisioningRunSupervisorQueryDto,
  ReviewResourceRequestDto,
  UpdateResourceTypeDto,
} from './dto/resource-request.dto';

import {
  AuditInput,
  ExternalProvisioningRunMode,
  HttpProvisioningFetch,
  HttpProvisioningResponse,
  JsonRecord,
  ProvisioningAutoRetryConfig,
  ProvisioningAutoRetrySummary,
  ProvisioningCredentialRef,
  ProvisioningMode,
  ProvisioningProcessorContext,
  ProvisioningProcessorTrigger,
  ProvisioningQueueConfig,
  ProvisioningQueueProcessSummary,
  ProvisioningResourceType,
  ProvisioningRunStatusCounts,
  ProvisioningStaleRecoverySummary,
  ProviderStatePollingConfig,
  ProviderStatePollingSummary,
  ResourceProvisioningRunRecord,
} from './resource-request.types';

import {
  asRecord,
  clampNonNegativeInteger,
  clampPositiveInteger,
  dateToIso,
  errorMessage,
  hasRecordValues,
  readBoolean,
  readListLimit,
  readNonNegativeInteger,
  readPositiveInteger,
  readString,
  readStringArray,
  readStringMap,
  truncateText,
} from './resource-provisioning-value.utils';
import {
  isImplicitSensitiveKey,
  readSensitiveFieldKeys,
  redactSensitiveRecord,
  redactUrl,
  resolveRequestedResourceName,
  splitDeliveryAndCredentials,
} from './resource-provisioning-sensitive.utils';
import {
  buildScriptProvisioningSteps,
  isReplayableExternalProvisioningMode,
  mapScriptProvisioningStatus,
  normalizeProvisioningMode,
  normalizeProvisioningProcessorTrigger,
  normalizeScriptStep,
  normalizeScriptStepRisk,
  provisioningAuditAction,
  provisioningAuditMessage,
  summarizeServerExecution,
} from './resource-provisioning-script.utils';
import {
  buildProviderStatePollingMetadata,
  readProviderMaxAttempts,
  readProviderProvisioningState,
  readProviderStatePollingConfig,
  readProviderStatePollingState,
  resolveProviderAdapterKey,
} from './resource-provisioning-provider-config.utils';
import {
  buildProviderProvisioningPlan,
  providerStateIndicatesCompleted,
  providerStateIndicatesFailed,
  readProviderStateReason,
  readProviderStateStatus,
  resolveProviderProvisioningDeliverySource,
  resolveProviderRunId,
  resolveRunCredentialRef,
} from './resource-provisioning-provider-state.utils';
import {
  buildProvisioningIdempotencyKey,
  exposeCredentialRef,
  readCredentialTypeAllowList,
  resolveAuthAdapterKey,
} from './resource-provisioning-http-config.utils';
import {
  buildHttpAutoRetryMetadata,
  isProvisioningAutoRetryDue,
  isRetryableHttpStatus,
  readHttpMaxAttempts,
  readHttpRetryStatusCodes,
  readProvisioningQueueConfig,
} from './resource-provisioning-http-retry.utils';
import {
  buildExternalProvisioningPayload,
  buildHttpProvisioningHeaders,
  readHttpProvisioningBody,
  resolveHttpProvisioningDeliverySource,
} from './resource-provisioning-http-request.utils';


@Injectable()
export class ResourceRequestService implements OnModuleInit {
  private readonly logger = new Logger(ResourceRequestService.name);

  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly resourceTypeService: ResourceTypeService,
    private readonly accessService: ResourceRequestAccessService,
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly runWriter: ResourceProvisioningRunWriterService,
    private readonly provisioning: ResourceRequestProvisioningService,
    private readonly recovery: ResourceRequestRecoveryService,
    private readonly providerState: ResourceProviderStateService,
    private readonly configService: ConfigService,
    private readonly resourcePoolService: ResourcePoolService,
    private readonly serverExecutor: ServerExecutorService,
    private readonly provisioningRunSupervisorService: ResourceProvisioningRunSupervisorService,
    private readonly provisioningRunReadService: ResourceProvisioningRunReadService,
  ) {}

  async onModuleInit() {
    await this.resourceTypeService.ensureDefaults();
  }

  async createResourceType(userId: string, dto: CreateResourceTypeDto) {
    return this.resourceTypeService.createResourceType(userId, dto);
  }

  async listResourceTypes(includeDisabled = false) {
    return this.resourceTypeService.listResourceTypes(includeDisabled);
  }

  async getResourceType(id: string) {
    return this.resourceTypeService.getResourceType(id);
  }

  async updateResourceType(id: string, dto: UpdateResourceTypeDto) {
    return this.resourceTypeService.updateResourceType(id, dto);
  }

  async disableResourceType(id: string) {
    return this.resourceTypeService.disableResourceType(id);
  }

  async resolveRequestInputAccessScope(teamId: string, dto: CreateResourceRequestDto) {
    return this.accessService.resolveRequestInputAccessScope(teamId, dto);
  }

  async getRequestAccessScope(teamId: string, id: string) {
    return this.accessService.getRequestAccessScope(teamId, id);
  }

  async getInstanceAccessScope(teamId: string, id: string) {
    return this.accessService.getInstanceAccessScope(teamId, id);
  }

  async createRequest(teamId: string, userId: string, dto: CreateResourceRequestDto) {
    const resourceType = await this.accessService.ensureResourceType(dto.resourceTypeId);
    const environmentRef = await this.accessService.resolveProjectEnvironment(teamId, dto.environmentId, dto.projectId);
    const projectId = environmentRef?.projectId ?? dto.projectId;
    await this.accessService.ensureProject(teamId, projectId);

    const request = await this.repo.createRequest({
      data: {
        teamId,
        projectId,
        environmentId: environmentRef?.id,
        resourceTypeId: dto.resourceTypeId,
        requesterId: userId,
        title: dto.title,
        environment: dto.environment || environmentRef?.key,
        purpose: dto.purpose,
        spec: dto.spec,
        status: resourceType.approvalMode === 'none' ? 'approved' : 'pending',
        reviewedAt: resourceType.approvalMode === 'none' ? new Date() : null,
      },
      include: this.statusWriter.requestInclude(),
    });

    await this.statusWriter.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: dto.resourceTypeId,
      requestId: request.id,
      action: 'request.created',
      message: '创建资源申请',
      metadata: { approvalMode: resourceType.approvalMode },
    });

    if (request.status === 'approved') {
      return this.provisioning.runApprovedProvisioningProcessor(teamId, userId, request, { trigger: 'approval' });
    }

    return request;
  }

  async listRequests(teamId: string, query: ListResourceRequestsQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;
    if (query.requesterId) where.requesterId = query.requesterId;

    return this.repo.findRequests({
      where,
      include: this.statusWriter.requestInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(teamId: string, id: string) {
    const request = await this.repo.findRequestFirst({
      where: { id, teamId },
      include: {
        ...this.statusWriter.requestInclude(),
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('资源申请不存在');
    }

    return request;
  }

  async listProvisioningRuns(teamId: string, requestId: string, query: ListResourceProvisioningRunsQueryDto) {
    return this.provisioningRunReadService.listRuns(
      teamId,
      requestId,
      query,
      (run) => serializeProvisioningRun(run as JsonRecord),
    );
  }

  async replayProvisioningRun(teamId: string, userId: string, requestId: string, runId: string) {
    return this.recovery.replayProvisioningRun(teamId, userId, requestId, runId);
  }

  async reconcileProviderProvisioningRun(
    teamId: string,
    userId: string | undefined,
    requestId: string,
    runId: string,
    dto: ReconcileProviderResourceProvisioningRunDto,
  ) {
    return this.providerState.reconcileProviderProvisioningRun(teamId, userId, requestId, runId, dto);
  }

  async getProvisioningRunSupervisor(teamId: string, query: ResourceProvisioningRunSupervisorQueryDto = {}) {
    return this.recovery.getProvisioningRunSupervisor(teamId, query);
  }

  async recoverTeamStaleProvisioningRuns(
    teamId: string,
    dto: RecoverStaleResourceProvisioningRunsDto = {},
  ) {
    return this.recovery.recoverTeamStaleProvisioningRuns(teamId, dto);
  }

  async processNextQueuedProvisioningRun(
    teamId: string | undefined,
    userId: string | undefined,
    dto: ProcessQueuedResourceProvisioningRunDto = {},
  ) {
    return this.recovery.processNextQueuedProvisioningRun(teamId, userId, dto);
  }

  async processDueProviderStatePollingRuns(options: { limit?: number; now?: Date } = {}) {
    return this.providerState.processDueProviderStatePollingRuns(options);
  }

  async processDueProvisioningAutoRetries(options: { limit?: number; now?: Date } = {}) {
    return this.recovery.processDueProvisioningAutoRetries(options);
  }

  async recoverStaleProvisioningRuns(
    options: { teamId?: string; limit?: number; now?: Date; staleAfterSeconds?: number } = {},
  ) {
    return this.recovery.recoverStaleProvisioningRuns(options);
  }

  async reviewRequest(teamId: string, userId: string, id: string, dto: ReviewResourceRequestDto) {
    const existing = await this.getRequest(teamId, id);

    if (existing.status !== 'pending') {
      throw new BadRequestException('只有待审批的申请可以审批');
    }

    const request = await this.repo.updateRequest({
      where: { id },
      data: {
        status: dto.status,
        reviewerId: userId,
        reviewedAt: new Date(),
        approvalComment: dto.comment,
      },
      include: this.statusWriter.requestInclude(),
    });

    await this.statusWriter.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId as string,
      requestId: existing.id as string,
      action: dto.status === 'approved' ? 'request.approved' : 'request.rejected',
      message: dto.comment,
    });

    if (dto.status === 'approved') {
      return this.provisioning.runApprovedProvisioningProcessor(teamId, userId, request, { trigger: 'approval' });
    }

    return request;
  }

  async completeRequest(teamId: string, userId: string, id: string, dto: CompleteResourceRequestDto) {
    const existing = await this.getRequest(teamId, id);

    if (!['approved', 'pending'].includes(existing.status)) {
      throw new BadRequestException('当前申请状态不能交付');
    }

    const mode = normalizeProvisioningMode(existing.resourceType?.provisioningMode);
    return this.statusWriter.completeProvisionedRequest(teamId, userId, existing, {
      createInstance: dto.createInstance !== false,
      instanceName: dto.instanceName || existing.title,
      config: asRecord(dto.config),
      delivery: asRecord(dto.delivery),
      credentials: asRecord(dto.credentials),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      provisioning: {
        mode,
        status: 'completed',
        boundary: 'manual_delivery',
        completedAt: new Date().toISOString(),
      },
      auditMetadata: {
        createInstance: dto.createInstance !== false,
        provisioningMode: mode,
        boundary: 'manual_delivery',
      },
    });
  }

  async retryProvisioning(teamId: string, userId: string, id: string) {
    const existing = await this.getRequest(teamId, id);
    return this.provisioning.retryProvisioningRecord(teamId, userId, existing, { trigger: 'manual_retry' });
  }

  async cancelRequest(teamId: string, userId: string, id: string) {
    const existing = await this.getRequest(teamId, id);

    if (existing.status === 'completed') {
      throw new BadRequestException('已完成的申请不能取消');
    }

    const request = await this.repo.updateRequest({
      where: { id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
      include: this.statusWriter.requestInclude(),
    });

    await this.statusWriter.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId,
      requestId: id,
      action: 'request.canceled',
      message: '资源申请已取消',
    });

    return request;
  }

  async listInstances(teamId: string, query: ListResourceInstancesQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;

    const instances = await this.repo.findInstances({
      where,
      include: this.statusWriter.instanceInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return instances.map((instance: Record<string, unknown>) => this.statusWriter.maskInstance(instance));
  }

  async getInstance(teamId: string, id: string) {
    const instance = await this.repo.findInstanceFirst({
      where: { id, teamId },
      include: {
        ...this.statusWriter.instanceInclude(),
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException('资源实例不存在');
    }

    return this.statusWriter.maskInstance(instance);
  }

  async getInstanceCredentialForGeneration(teamId: string, id: string) {
    const instance = await this.repo.findInstanceFirst({
      where: { id, teamId },
      include: {
        resourceType: {
          select: { id: true, key: true, name: true },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException('资源实例不存在');
    }

    if (instance.status !== 'active') {
      throw new BadRequestException('只有 active 状态的资源实例可以用于生成项目');
    }

    const delivery = (instance.delivery && typeof instance.delivery === 'object')
      ? instance.delivery
      : {};
    const credentials = instance.credentials
      ? JSON.parse(this.statusWriter.decrypt(instance.credentials))
      : {};

    return {
      id: instance.id,
      type: instance.resourceType.key,
      name: instance.name,
      config: {
        ...delivery,
        ...credentials,
      } as Record<string, unknown>,
    };
  }

  async releaseInstance(teamId: string, userId: string, id: string) {
    const existing = await this.repo.findInstanceFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('资源实例不存在');
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('只有 active 状态的资源实例可以释放');
    }

    const instance = await this.repo.updateInstance({
      where: { id },
      data: {
        status: 'released',
        releasedAt: new Date(),
      },
      include: this.statusWriter.instanceInclude(),
    });

    await this.statusWriter.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId,
      requestId: existing.requestId,
      instanceId: id,
      action: 'instance.released',
      message: '资源实例已释放',
    });

    return this.statusWriter.maskInstance(instance);
  }

  async listAuditLogs(teamId: string, query: ListResourceAuditLogsQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.requestId) where.requestId = query.requestId;
    if (query.instanceId) where.instanceId = query.instanceId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;
    if (query.action) where.action = query.action;

    return this.repo.findResourceAuditLogs({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        resourceType: { select: { id: true, key: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
