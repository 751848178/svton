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
import { ResourceTypeService } from './resource-type.service';
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
    private readonly configService: ConfigService,
    private readonly resourcePoolService: ResourcePoolService,
    private readonly serverExecutor: ServerExecutorService,
    private readonly provisioningRunSupervisorService: ResourceProvisioningRunSupervisorService,
    private readonly provisioningRunReadService: ResourceProvisioningRunReadService,
  ) {}

  async onModuleInit() {
    await this.resourceTypeService.ensureDefaults();
  }


  private serializeProvisioningRun(run: JsonRecord) {
    return {
      id: run.id,
      requestId: run.requestId,
      resourceTypeId: run.resourceTypeId,
      resourceType: run.resourceType,
      actor: run.actor,
      replayOfRunId: run.replayOfRunId,
      replayOf: run.replayOf,
      replayAttemptsCount: asRecord(run._count).replayAttempts ?? 0,
      mode: run.mode,
      trigger: run.trigger,
      boundary: run.boundary,
      executorKey: run.executorKey,
      adapterKey: run.adapterKey,
      authAdapterKey: run.authAdapterKey,
      idempotencyKey: run.idempotencyKey,
      providerRunId: run.providerRunId,
      status: run.status,
      queueMode: run.queueMode,
      attempt: run.attempt,
      maxAttempts: run.maxAttempts,
      retryable: run.retryable,
      autoRetry: run.autoRetry,
      params: asRecord(run.params),
      result: asRecord(run.result),
      error: run.error,
      startedAt: run.startedAt,
      queuedAt: run.queuedAt,
      availableAt: run.availableAt,
      lockedAt: run.lockedAt,
      lockOwner: run.lockOwner,
      finishedAt: run.finishedAt,
      recoveredAt: run.recoveredAt,
      recoveryReason: run.recoveryReason,
      recoveryCount: run.recoveryCount,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
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
      return this.runApprovedProvisioningProcessor(teamId, userId, request, { trigger: 'approval' });
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
      (run) => this.serializeProvisioningRun(run as JsonRecord),
    );
  }

  async replayProvisioningRun(teamId: string, userId: string, requestId: string, runId: string) {
    const existing = await this.getRequest(teamId, requestId);
    const run = await this.repo.findRunFirst({
      where: { id: runId, teamId, requestId },
    });

    if (!run) {
      throw new NotFoundException('资源交付运行不存在');
    }

    const mode = normalizeProvisioningMode(run.mode);
    if (!isReplayableExternalProvisioningMode(mode)) {
      throw new BadRequestException('只有外部交付运行可以重放');
    }

    const runStatus = readString(run.status);
    if (!['planned', 'blocked', 'failed'].includes(runStatus)) {
      throw new BadRequestException('只有已生成计划、已阻断或失败的交付运行可以重放');
    }

    const currentProvisioning = asRecord(asRecord(existing.result).provisioning);
    const currentRunId = readString(currentProvisioning.provisioningRunId);
    if (currentRunId !== run.id) {
      throw new BadRequestException('只能重放当前资源申请正在指向的交付运行');
    }

    return this.retryProvisioningRecord(teamId, userId, existing, {
      trigger: 'manual_retry',
      replayOfRunId: run.id,
      replaySourceStatus: runStatus,
    });
  }

  async reconcileProviderProvisioningRun(
    teamId: string,
    userId: string | undefined,
    requestId: string,
    runId: string,
    dto: ReconcileProviderResourceProvisioningRunDto,
  ) {
    const existing = await this.getRequest(teamId, requestId);
    const run = await this.repo.findRunFirst({
      where: { id: runId, teamId, requestId },
    });

    if (!run) {
      throw new NotFoundException('资源交付运行不存在');
    }

    const mode = normalizeProvisioningMode(run.mode);
    if (mode !== 'provider') {
      throw new BadRequestException('只有 provider SDK 交付运行可以对账 providerState');
    }

    if (existing.status !== 'approved') {
      throw new BadRequestException('只有已审批且未交付的 provider 申请可以对账');
    }

    const currentProvisioning = asRecord(asRecord(existing.result).provisioning);
    const currentRunId = readString(currentProvisioning.provisioningRunId);
    if (currentRunId !== run.id) {
      throw new BadRequestException('只能对账当前资源申请正在指向的 provider 交付运行');
    }

    const runStatus = readString(run.status);
    if (!['planned', 'blocked', 'failed', 'running'].includes(runStatus)) {
      throw new BadRequestException('只有已生成计划、已阻断、失败或运行中的 provider 交付运行可以对账');
    }

    const providerState = asRecord(dto.providerState);
    if (!hasRecordValues(providerState)) {
      throw new BadRequestException('providerState 不能为空');
    }

    const resourceType = await this.getProvisioningResourceType(existing.resourceTypeId as string);
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const runParams = asRecord(run.params);
    const provider = (
      readString(providerState.provider)
      || readString(runParams.provider)
      || readString(provisioningConfig.provider)
      || readString(provisioningConfig.providerKey)
    );
    const operation = (
      readString(providerState.operation)
      || readString(runParams.operation)
      || readString(provisioningConfig.operation)
      || readString(provisioningConfig.action)
      || `provision.${resourceType.key}`
    );
    const region = (
      readString(providerState.region)
      || readString(runParams.region)
      || readString(provisioningConfig.region)
      || readString(asRecord(existing.spec).region)
    );
    const idempotencyKey = readString(run.idempotencyKey)
      || buildProvisioningIdempotencyKey(existing, resourceType, 'provider', provisioningConfig);
    const executorKey = readString(run.executorKey) || readString(provisioningConfig.executorKey) || 'cloud-sdk';
    const adapterKey = readString(run.adapterKey) || resolveProviderAdapterKey(provider, provisioningConfig);
    const providerStateStatus = readProviderStateStatus(providerState);
    const providerStateSummary = redactSensitiveRecord(providerState);
    const providerRunId = resolveProviderRunId(providerState, {
      ...provisioningConfig,
      ...runParams,
    }, idempotencyKey);
    const credentialRef = resolveRunCredentialRef(run, currentProvisioning);
    const reconciledAt = new Date().toISOString();
    const baseProvisioning = {
      mode: 'provider',
      boundary: 'provider_sdk_adapter',
      provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
      provider: provider || undefined,
      operation,
      region: region || undefined,
      executorKey,
      adapterKey,
      idempotencyKey,
      credentialRef: credentialRef || undefined,
      providerRunId,
      providerStateStatus: providerStateStatus || undefined,
      providerState: providerStateSummary,
      reconciledAt,
      reconciledBy: userId,
    };

    await this.statusWriter.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId as string,
      requestId: existing.id as string,
      provisioningRunId: run.id as string,
      action: 'provisioning.provider_state_reconciled',
      message: '对账 provider SDK 交付运行状态',
      metadata: {
        ...baseProvisioning,
        previousStatus: runStatus,
      },
    });

    if (providerStateIndicatesCompleted(providerState)) {
      const deliverySource = resolveProviderProvisioningDeliverySource(providerState, provisioningConfig);
      const split = splitDeliveryAndCredentials(deliverySource, resourceType.deliverySchema);
      const adapterConfig = {
        ...asRecord(asRecord(providerState).config),
        ...asRecord(provisioningConfig.instanceConfig),
      };
      const createInstance = readBoolean(
        dto.createInstance,
        readBoolean(providerState.createInstance, readBoolean(provisioningConfig.createInstanceOnSuccess, true)),
      );
      const shouldCreateInstance = createInstance && (
        hasRecordValues(split.delivery)
        || hasRecordValues(split.credentials)
        || hasRecordValues(adapterConfig)
      );
      const completedProvisioning = {
        ...baseProvisioning,
        status: 'completed',
        deliveryKeys: Object.keys(split.delivery),
        credentialKeys: Object.keys(split.credentials),
        createInstance: shouldCreateInstance,
        recoveredFromProviderState: true,
        completedAt: reconciledAt,
      };
      const completion = await this.statusWriter.completeProvisionedRequest(teamId, userId, existing, {
        createInstance: shouldCreateInstance,
        instanceName: (
          readString(dto.instanceName)
          || readString(providerState.instanceName)
          || readString(providerState.resourceName)
          || resolveRequestedResourceName(existing.spec)
          || (existing.title as string)
        ),
        config: {
          ...adapterConfig,
          provisioningMode: 'provider',
          adapter: 'provider',
          provider: provider || undefined,
          operation,
          region: region || undefined,
          providerRunId,
          credentialRef: credentialRef || undefined,
        },
        delivery: split.delivery,
        credentials: split.credentials,
        provisioning: completedProvisioning,
        auditMetadata: {
          createInstance: shouldCreateInstance,
          provisioningMode: 'provider',
          boundary: 'provider_sdk_adapter',
          provider: provider || undefined,
          operation,
          region: region || undefined,
          idempotencyKey,
          credentialRef: credentialRef || undefined,
          providerRunId,
          providerStateStatus: providerStateStatus || undefined,
          provisioningRunId: run.id as string,
          recoveredFromProviderState: true,
          reconciledAt,
        },
      });

      await this.runWriter.finishProvisioningRun(run as ResourceProvisioningRunRecord, completedProvisioning);
      return completion.request;
    }

    const failed = providerStateIndicatesFailed(providerState);
    const status = failed ? 'blocked' : 'planned';
    return this.runWriter.markProvisioningStatusWithRun(teamId, userId, existing, {
      ...baseProvisioning,
      status,
      reason: failed ? readProviderStateReason(providerState) : 'provider_state_pending',
      retryable: false,
      requiresManualCompletion: !failed,
      updatedAt: reconciledAt,
    }, run as ResourceProvisioningRunRecord);
  }

  async getProvisioningRunSupervisor(teamId: string, query: ResourceProvisioningRunSupervisorQueryDto = {}) {
    return this.provisioningRunSupervisorService.getSupervisorSnapshot(
      teamId,
      query,
      (run) => this.serializeProvisioningRun(run as JsonRecord),
    );
  }

  async recoverTeamStaleProvisioningRuns(
    teamId: string,
    dto: RecoverStaleResourceProvisioningRunsDto = {},
  ) {
    return this.recoverStaleProvisioningRuns({
      teamId,
      limit: readListLimit(dto.limit, 10, 100),
      staleAfterSeconds: this.readStaleProvisioningRunAfterSeconds(dto.staleAfterSeconds),
    });
  }

  async processNextQueuedProvisioningRun(
    teamId: string | undefined,
    userId: string | undefined,
    dto: ProcessQueuedResourceProvisioningRunDto = {},
  ): Promise<ProvisioningQueueProcessSummary> {
    const now = new Date();
    const lockOwner = userId || 'resource-request-queue-worker';
    const run = await this.repo.findRunFirst({
      where: {
        ...(teamId ? { teamId } : {}),
        status: 'queued',
        queueMode: 'queued',
        mode: { in: ['api', 'webhook'] },
        ...(dto.runId
          ? { id: dto.runId }
          : { OR: [{ availableAt: null }, { availableAt: { lte: now } }] }),
      },
      orderBy: [
        { availableAt: 'asc' },
        { startedAt: 'asc' },
      ],
      include: {
        request: {
          include: this.statusWriter.requestInclude(),
        },
        actor: { select: { id: true, name: true, email: true } },
        resourceType: { select: { id: true, key: true, name: true } },
        _count: { select: { replayAttempts: true } },
      },
    });

    if (!run) {
      return {
        scanned: 0,
        processed: 0,
        skipped: 0,
        failed: 0,
        reason: dto.runId ? 'queued_run_not_found' : 'queue_empty',
      };
    }

    const claim = await this.repo.updateRuns({
      where: {
        id: run.id,
        ...(teamId ? { teamId } : {}),
        status: 'queued',
        queueMode: 'queued',
      },
      data: {
        status: 'running',
        startedAt: now,
        lockedAt: now,
        lockOwner,
      },
    });

    if (claim.count !== 1) {
      return {
        scanned: 1,
        processed: 0,
        skipped: 1,
        failed: 0,
        reason: 'queue_claim_conflict',
        run: this.serializeProvisioningRun(run),
      };
    }

    const claimedRun = {
      ...run,
      status: 'running',
      startedAt: now,
      lockedAt: now,
      lockOwner,
    } as ResourceProvisioningRunRecord;
    const request = asRecord(run.request);
    const currentProvisioning = asRecord(asRecord(request.result).provisioning);
    const currentRunId = readString(currentProvisioning.provisioningRunId);

    if (request.status !== 'approved' || currentRunId !== run.id) {
      const reason = request.status !== 'approved'
        ? 'queued_request_not_approved'
        : 'queued_run_not_current';
      const skippedProvisioning = {
        ...currentProvisioning,
        mode: run.mode,
        status: 'failed',
        boundary: run.boundary || 'http_adapter',
        provisioningRunId: run.id,
        replayOfRunId: run.replayOfRunId || undefined,
        idempotencyKey: run.idempotencyKey,
        queueMode: run.queueMode || 'queued',
        queuedAt: dateToIso(run.queuedAt),
        availableAt: dateToIso(run.availableAt),
        reason,
        retryable: false,
        failedAt: now.toISOString(),
      };
      await this.runWriter.finishProvisioningRun(claimedRun, skippedProvisioning);
      await this.statusWriter.writeAudit({
        teamId: run.teamId as string,
        actorId: userId,
        resourceTypeId: run.resourceTypeId as string,
        requestId: run.requestId as string,
        provisioningRunId: run.id as string,
        action: 'provisioning.queue_skipped',
        message: '跳过不再可执行的资源交付队列运行',
        metadata: skippedProvisioning,
      });
      return {
        scanned: 1,
        processed: 0,
        skipped: 1,
        failed: 0,
        reason,
        run: this.serializeProvisioningRun({ ...claimedRun, status: 'failed', error: reason, finishedAt: now }),
      };
    }

    try {
      const processed = await this.runApprovedProvisioningProcessor(run.teamId as string, userId, request, {
        trigger: normalizeProvisioningProcessorTrigger(run.trigger),
        replayOfRunId: readString(run.replayOfRunId) || undefined,
        provisioningRunId: run.id as string,
        forceInline: true,
      });
      return {
        scanned: 1,
        processed: 1,
        skipped: 0,
        failed: 0,
        run: this.serializeProvisioningRun(claimedRun),
        request: processed,
      };
    } catch (error) {
      const reason = errorMessage(error);
      const failedProvisioning = {
        ...currentProvisioning,
        mode: run.mode,
        status: 'failed',
        boundary: run.boundary || 'http_adapter',
        provisioningRunId: run.id,
        replayOfRunId: run.replayOfRunId || undefined,
        idempotencyKey: run.idempotencyKey,
        queueMode: run.queueMode || 'queued',
        queuedAt: dateToIso(run.queuedAt),
        availableAt: dateToIso(run.availableAt),
        reason,
        retryable: true,
        failedAt: now.toISOString(),
      };
      await this.runWriter.finishProvisioningRun(claimedRun, failedProvisioning);
      await this.statusWriter.writeAudit({
        teamId: run.teamId as string,
        actorId: userId,
        resourceTypeId: run.resourceTypeId as string,
        requestId: run.requestId as string,
        provisioningRunId: run.id as string,
        action: 'provisioning.queue_failed',
        message: '资源交付队列运行执行失败',
        metadata: failedProvisioning,
      });
      return {
        scanned: 1,
        processed: 0,
        skipped: 0,
        failed: 1,
        reason,
        run: this.serializeProvisioningRun({ ...claimedRun, status: 'failed', error: reason, finishedAt: now }),
      };
    }
  }

  async processDueProviderStatePollingRuns(
    options: { limit?: number; now?: Date } = {},
  ): Promise<ProviderStatePollingSummary> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const now = options.now ?? new Date();
    const lockOwner = 'resource-request-provider-state-poller';
    const runs = await this.repo.findRuns({
      where: {
        mode: 'provider',
        status: 'planned',
        OR: [{ availableAt: null }, { availableAt: { lte: now } }],
      },
      orderBy: [
        { availableAt: 'asc' },
        { startedAt: 'asc' },
      ],
      take: Math.min(limit * 5, 250),
      include: {
        request: { include: this.statusWriter.requestInclude() },
        resourceType: {
          select: {
            id: true,
            key: true,
            name: true,
            provisioningMode: true,
            provisioningConfig: true,
            deliverySchema: true,
          },
        },
      },
    });

    const summary: ProviderStatePollingSummary = {
      scanned: runs.length,
      polled: 0,
      completed: 0,
      planned: 0,
      blocked: 0,
      skipped: 0,
      failed: 0,
    };

    for (const run of runs) {
      if (summary.polled >= limit) {
        break;
      }

      const request = asRecord(run.request);
      const currentProvisioning = asRecord(asRecord(request.result).provisioning);
      const currentRunId = readString(currentProvisioning.provisioningRunId);
      if (request.status !== 'approved' || currentRunId !== run.id) {
        summary.skipped += 1;
        continue;
      }

      const resourceType = asRecord(run.resourceType) as unknown as ProvisioningResourceType;
      const pollingConfig = readProviderStatePollingConfig(asRecord(resourceType.provisioningConfig));
      if (!pollingConfig.enabled) {
        summary.skipped += 1;
        continue;
      }

      const attempt = (readNonNegativeInteger(run.attempt) ?? 0) + 1;
      const nextAvailableAt = new Date(now.getTime() + pollingConfig.intervalSeconds * 1000);
      const claim = await this.repo.updateRuns({
        where: {
          id: run.id,
          mode: 'provider',
          status: 'planned',
          OR: [{ availableAt: null }, { availableAt: { lte: now } }],
        },
        data: {
          status: 'running',
          attempt,
          lockedAt: now,
          lockOwner,
        },
      });

      if (claim.count !== 1) {
        summary.skipped += 1;
        continue;
      }

      summary.polled += 1;
      const claimedRun = {
        ...run,
        status: 'running',
        attempt,
        lockedAt: now,
        lockOwner,
      } as ResourceProvisioningRunRecord;

      try {
        if (attempt > pollingConfig.maxAttempts) {
          await this.blockProviderStatePollingRun(
            claimedRun,
            request,
            currentProvisioning,
            pollingConfig,
            attempt,
            now,
            'provider_state_polling_max_attempts_exceeded',
          );
          summary.blocked += 1;
          continue;
        }

        const polledState = readProviderStatePollingState(
          asRecord(resourceType.provisioningConfig),
          attempt,
        );
        if (!hasRecordValues(polledState.providerState)) {
          await this.markProviderStatePollingPending(
            claimedRun,
            request,
            currentProvisioning,
            pollingConfig,
            attempt,
            now,
            nextAvailableAt,
            'provider_state_poll_no_state',
            polledState.source,
          );
          summary.planned += 1;
          continue;
        }

        await this.statusWriter.writeAudit({
          teamId: run.teamId as string,
          resourceTypeId: run.resourceTypeId as string,
          requestId: run.requestId as string,
          provisioningRunId: run.id as string,
          action: 'provisioning.provider_state_polled',
          message: '自动轮询 provider SDK 交付状态',
          metadata: {
            providerPolling: buildProviderStatePollingMetadata(
              pollingConfig,
              attempt,
              now,
              nextAvailableAt,
              {
                source: polledState.source,
                stateFound: true,
                providerStateStatus: readProviderStateStatus(polledState.providerState) || undefined,
              },
            ),
            providerState: redactSensitiveRecord(polledState.providerState),
          },
        });

        const updated = await this.reconcileProviderProvisioningRun(
          run.teamId as string,
          undefined,
          request.id as string,
          run.id as string,
          {
            providerState: polledState.providerState,
            createInstance: pollingConfig.createInstance,
            instanceName: pollingConfig.instanceName,
          },
        );
        const resultProvisioning = asRecord(asRecord(updated.result).provisioning);
        const status = readString(resultProvisioning.status);
        if (status === 'completed') {
          summary.completed += 1;
        } else if (status === 'blocked') {
          summary.blocked += 1;
        } else {
          await this.updateProviderStatePollingMetadata(
            claimedRun,
            resultProvisioning,
            pollingConfig,
            attempt,
            now,
            nextAvailableAt,
            polledState.source,
          );
          summary.planned += 1;
        }
      } catch (error) {
        summary.failed += 1;
        await this.markProviderStatePollingError(
          claimedRun,
          request,
          currentProvisioning,
          pollingConfig,
          attempt,
          now,
          nextAvailableAt,
          errorMessage(error),
        );
      }
    }

    return summary;
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
      return this.runApprovedProvisioningProcessor(teamId, userId, request, { trigger: 'approval' });
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
    return this.retryProvisioningRecord(teamId, userId, existing, { trigger: 'manual_retry' });
  }

  private async retryProvisioningRecord(
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
      return this.provisionWithHttpAdapter(
        teamId,
        userId,
        existing,
        resourceType,
        mode,
        context,
      );
    }

    await this.statusWriter.writeAudit(auditInput);
    return this.runApprovedProvisioningProcessor(teamId, userId as string, existing, context);
  }

  async processDueProvisioningAutoRetries(
    options: { limit?: number; now?: Date } = {},
  ): Promise<ProvisioningAutoRetrySummary> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const now = options.now ?? new Date();
    const requests = await this.repo.findRequests({
      where: { status: 'approved' },
      include: this.statusWriter.requestInclude(),
      orderBy: { updatedAt: 'asc' },
      take: Math.min(limit * 5, 250),
    });

    const summary: ProvisioningAutoRetrySummary = {
      scanned: requests.length,
      attempted: 0,
      completed: 0,
      blocked: 0,
      skipped: 0,
      failed: 0,
    };

    for (const request of requests) {
      if (summary.attempted >= limit) {
        break;
      }

      if (!isProvisioningAutoRetryDue(request, now)) {
        summary.skipped += 1;
        continue;
      }

      summary.attempted += 1;
      try {
        const result = await this.retryProvisioningRecord(
          request.teamId as string,
          undefined,
          request,
          { trigger: 'auto_retry' },
        );
        const resultProvisioning = asRecord(asRecord(result.result).provisioning);
        const status = readString(resultProvisioning.status);
        if (status === 'completed') {
          summary.completed += 1;
        } else if (status === 'blocked') {
          summary.blocked += 1;
        }
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`ResourceRequest provisioning auto retry failed: ${errorMessage(error)}`);
      }
    }

    return summary;
  }

  async recoverStaleProvisioningRuns(
    options: { teamId?: string; limit?: number; now?: Date; staleAfterSeconds?: number } = {},
  ): Promise<ProvisioningStaleRecoverySummary> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const now = options.now ?? new Date();
    const staleAfterSeconds = this.readStaleProvisioningRunAfterSeconds(options.staleAfterSeconds);
    const staleBefore = new Date(now.getTime() - staleAfterSeconds * 1000);
    const runs = await this.repo.findRuns({
      where: {
        ...(options.teamId ? { teamId: options.teamId } : {}),
        status: 'running',
        mode: { in: ['api', 'webhook'] },
        startedAt: { lt: staleBefore },
      },
      orderBy: { startedAt: 'asc' },
      take: limit,
      include: {
        request: {
          include: this.statusWriter.requestInclude(),
        },
      },
    });

    const summary: ProvisioningStaleRecoverySummary = {
      scanned: runs.length,
      recovered: 0,
      requestUpdated: 0,
      skipped: 0,
      failed: 0,
    };

    for (const run of runs) {
      try {
        const request = asRecord(run.request);
        const currentProvisioning = asRecord(asRecord(request.result).provisioning);
        const currentRunId = readString(currentProvisioning.provisioningRunId);
        const shouldUpdateRequest = request.status === 'approved' && currentRunId === run.id;
        const recoveryReason = 'stale_running_recovered';
        const recovery = {
          reason: recoveryReason,
          recoveredAt: now.toISOString(),
          staleAfterSeconds,
          staleBefore: staleBefore.toISOString(),
          previousStatus: run.status,
          currentRequestRun: shouldUpdateRequest,
        };
        const recoveryCount = (readNonNegativeInteger(run.recoveryCount) || 0) + 1;
        const recoveredRunProvisioning = {
          ...asRecord(asRecord(run.result).provisioning),
          mode: run.mode,
          status: 'failed',
          boundary: run.boundary || 'http_adapter',
          provisioningRunId: run.id,
          idempotencyKey: run.idempotencyKey,
          reason: recoveryReason,
          retryable: true,
          recoveredAt: now.toISOString(),
          recovery,
        };

        await this.repo.updateRun({
          where: { id: run.id },
          data: {
            status: 'failed',
            retryable: true,
            error: recoveryReason,
            result: {
              ...asRecord(run.result),
              provisioning: recoveredRunProvisioning,
              recovery,
            },
            finishedAt: now,
            recoveredAt: now,
            recoveryReason,
            recoveryCount,
          },
        });

        await this.statusWriter.writeAudit({
          teamId: run.teamId as string,
          resourceTypeId: run.resourceTypeId as string,
          requestId: run.requestId as string,
          provisioningRunId: run.id as string,
          action: 'provisioning.run_stale_recovered',
          message: '恢复超时未结束的资源交付运行',
          metadata: recovery,
        });

        summary.recovered += 1;

        if (shouldUpdateRequest) {
          await this.statusWriter.markProvisioningStatus(run.teamId as string, undefined, request, {
            ...currentProvisioning,
            mode: run.mode,
            status: 'blocked',
            boundary: run.boundary || 'http_adapter',
            provisioningRunId: run.id,
            idempotencyKey: run.idempotencyKey,
            reason: recoveryReason,
            retryable: true,
            recoveredAt: now.toISOString(),
            recovery,
          });
          summary.requestUpdated += 1;
        } else {
          summary.skipped += 1;
        }
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`ResourceRequest provisioning run stale recovery failed: ${errorMessage(error)}`);
      }
    }

    return summary;
  }

  private async runApprovedProvisioningProcessor(
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
      return this.provisionFromPool(teamId, userId as string, request, resourceType);
    }

    if (mode === 'script') {
      return this.provisionWithScript(teamId, userId as string, request, resourceType);
    }

    if (mode === 'provider') {
      return this.provisionWithProviderAdapter(teamId, userId, request, resourceType, context);
    }

    return this.provisionWithHttpAdapter(teamId, userId, request, resourceType, mode, context);
  }

  private async getProvisioningResourceType(resourceTypeId: string): Promise<ProvisioningResourceType> {
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

  private async provisionFromPool(
    teamId: string,
    userId: string,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
  ) {
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const poolId = readString(provisioningConfig.poolId);

    if (!poolId) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        reason: 'missing_pool_id',
        blockedAt: new Date().toISOString(),
      });
    }

    const projectId = readString(request.projectId);
    if (!projectId) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        poolId,
        reason: 'missing_project_id',
        blockedAt: new Date().toISOString(),
      });
    }

    let allocation: { id: string; type?: string; resourceName: string; credentials?: unknown };
    try {
      allocation = await this.resourcePoolService.allocateResource(
        {
          poolId,
          projectId,
          resourceName: resolveRequestedResourceName(request.spec),
        },
        userId,
        teamId,
      );
    } catch (error) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        poolId,
        reason: errorMessage(error),
        blockedAt: new Date().toISOString(),
      });
    }

    const split = splitDeliveryAndCredentials(allocation.credentials, resourceType.deliverySchema);
    const completedAt = new Date().toISOString();
    const completion = await this.statusWriter.completeProvisionedRequest(teamId, userId, request, {
      createInstance: true,
      instanceName: allocation.resourceName || (request.title as string),
      config: {
        provisioningMode: 'pool',
        poolId,
        poolAllocationId: allocation.id,
        poolType: allocation.type || resourceType.key,
        resourceName: allocation.resourceName,
      },
      delivery: {
        ...split.delivery,
        poolAllocationId: allocation.id,
        poolType: allocation.type || resourceType.key,
        resourceName: allocation.resourceName,
      },
      credentials: split.credentials,
      provisioning: {
        mode: 'pool',
        status: 'completed',
        boundary: 'resource_pool',
        poolId,
        allocationId: allocation.id,
        resourceName: allocation.resourceName,
        poolType: allocation.type || resourceType.key,
        completedAt,
      },
      auditMetadata: {
        createInstance: true,
        provisioningMode: 'pool',
        boundary: 'resource_pool',
        poolId,
        allocationId: allocation.id,
        resourceName: allocation.resourceName,
      },
    });

    return completion.request;
  }

  private async provisionWithScript(
    teamId: string,
    userId: string,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
  ) {
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const steps = buildScriptProvisioningSteps(provisioningConfig);

    if (steps.length === 0) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: 'missing_script_steps',
        blockedAt: new Date().toISOString(),
      });
    }

    const serverId = readString(provisioningConfig.serverId);
    const target = await this.serverExecutor.resolveTarget(teamId, serverId || null);
    const dryRun = readBoolean(provisioningConfig.dryRun, true);
    const queue = readBoolean(provisioningConfig.queue, false);
    const adapterKey = readString(provisioningConfig.adapterKey) || 'resource-provisioning-script';
    const idempotencyKey = buildProvisioningIdempotencyKey(request, resourceType, 'script', provisioningConfig);
    let credentialRef: ProvisioningCredentialRef | null;

    try {
      credentialRef = await this.resolveProvisioningCredentialRef(teamId, provisioningConfig);
    } catch (error) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: errorMessage(error),
        idempotencyKey,
        blockedAt: new Date().toISOString(),
      });
    }

    const executionInput: ServerExecutionInput = {
      teamId,
      userId,
      operationKey: readString(provisioningConfig.operationKey) || `resource.provision.${resourceType.key}`,
      adapterKey,
      dryRun,
      target,
      steps,
      warnings: readStringArray(provisioningConfig.warnings),
      metadata: {
        requestId: request.id,
        resourceTypeId: resourceType.id,
        resourceTypeKey: resourceType.key,
        projectId: request.projectId,
        environmentId: request.environmentId,
        provisioningMode: 'script',
        boundary: 'resource_request',
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        businessRunSync: queue ? 'resource_request_provisioning' : undefined,
      },
      blockOnWarnings: !dryRun,
      requiredConfirmationText: readString(provisioningConfig.requiredConfirmationText) || undefined,
      confirmationText: readString(provisioningConfig.confirmationText) || undefined,
    };

    let execution: ServerExecutionResult;
    try {
      execution = queue
        ? await this.serverExecutor.queueExecution(executionInput, {
            maxAttempts: readPositiveInteger(provisioningConfig.maxAttempts),
          })
        : await this.serverExecutor.execute(executionInput);
    } catch (error) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'script',
        status: 'blocked',
        boundary: 'server_executor',
        reason: errorMessage(error),
        serverId: serverId || undefined,
        dryRun,
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        blockedAt: new Date().toISOString(),
      });
    }

    const provisioningStatus = mapScriptProvisioningStatus(execution, dryRun);
    return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
      mode: 'script',
      status: provisioningStatus,
      boundary: 'server_executor',
      dryRun,
      serverId: serverId || undefined,
      targetTransport: target.transport,
      idempotencyKey,
      credentialRef: credentialRef || undefined,
      requiresManualCompletion: provisioningStatus !== 'completed',
      ...summarizeServerExecution(execution),
      updatedAt: new Date().toISOString(),
    });
  }

  private async provisionWithHttpAdapter(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
    mode: Extract<ProvisioningMode, 'webhook' | 'api'>,
    context: ProvisioningProcessorContext,
  ) {
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const url = readString(provisioningConfig.url) || readString(provisioningConfig.endpoint);
    const method = (readString(provisioningConfig.method) || 'POST').toUpperCase();
    const idempotencyKey = buildProvisioningIdempotencyKey(request, resourceType, mode, provisioningConfig);
    const maxAttempts = readHttpMaxAttempts(provisioningConfig);
    const queueConfig = readProvisioningQueueConfig(
      provisioningConfig,
      this.httpProvisioningQueueEnabled(),
    );
    const provisioningRun = await this.runWriter.createProvisioningRun(
      teamId,
      userId,
      request,
      resourceType,
      mode,
      context,
      provisioningConfig,
      {
        method,
        url: url ? redactUrl(url) : undefined,
        idempotencyKey,
        maxAttempts,
        queue: queueConfig,
      },
    );

    if (queueConfig.enabled && !context.forceInline) {
      return this.runWriter.markProvisioningQueuedWithRun(teamId, userId, request, {
        mode,
        method,
        url: url ? redactUrl(url) : undefined,
        idempotencyKey,
        queue: queueConfig,
      }, provisioningRun);
    }

    if (!url) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        idempotencyKey,
        reason: 'missing_url',
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    if (!['POST', 'PUT', 'PATCH', 'GET'].includes(method)) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: redactUrl(url),
        idempotencyKey,
        reason: 'unsupported_method',
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    let credentialRef: ProvisioningCredentialRef | null;
    try {
      credentialRef = await this.resolveProvisioningCredentialRef(teamId, provisioningConfig);
    } catch (error) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: redactUrl(url),
        idempotencyKey,
        reason: errorMessage(error),
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }
    await this.runWriter.attachProvisioningRunCredentialRef(provisioningRun, credentialRef);

    if (!this.httpProvisioningEnabled()) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'planned',
        boundary: 'http_adapter',
        method,
        url: redactUrl(url),
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        reason: 'http_dispatch_disabled',
        requiresManualCompletion: true,
        plannedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    const fetchFn = (globalThis as typeof globalThis & { fetch?: HttpProvisioningFetch }).fetch;
    if (!fetchFn) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: redactUrl(url),
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        reason: 'fetch_unavailable',
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    let response: HttpProvisioningResponse | null = null;
    let responseBody: unknown = {};
    let attempt = 0;
    const timeoutMs = readPositiveInteger(provisioningConfig.timeoutMs) || 15000;
    const retryStatusCodes = readHttpRetryStatusCodes(provisioningConfig);
    const retryOnNetworkError = readBoolean(provisioningConfig.retryOnNetworkError, true);
    const requestPayload = buildExternalProvisioningPayload(
      request,
      resourceType,
      mode,
      credentialRef,
      idempotencyKey,
    );

    for (attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        response = await fetchFn(url, {
          method,
          headers: buildHttpProvisioningHeaders(provisioningConfig, idempotencyKey, credentialRef),
          body: method === 'GET'
            ? undefined
            : JSON.stringify(requestPayload),
          signal: controller.signal,
        });
        responseBody = await readHttpProvisioningBody(response);

        if (response.ok || !isRetryableHttpStatus(response.status, retryStatusCodes) || attempt >= maxAttempts) {
          break;
        }
      } catch (error) {
        if (!retryOnNetworkError || attempt >= maxAttempts) {
          const blockedAt = new Date();
          return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
            mode,
            status: 'blocked',
            boundary: 'http_adapter',
            method,
            url: redactUrl(url),
            idempotencyKey,
            credentialRef: credentialRef || undefined,
            reason: errorMessage(error),
            retryable: retryOnNetworkError,
            attempt,
            maxAttempts,
            attemptsExhausted: attempt >= maxAttempts,
            blockedAt: blockedAt.toISOString(),
            ...buildHttpAutoRetryMetadata(
              provisioningConfig,
              request,
              retryOnNetworkError,
              context,
              blockedAt,
            ),
          }, provisioningRun);
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!response) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: redactUrl(url),
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        reason: 'http_response_unavailable',
        retryable: false,
        attempt,
        maxAttempts,
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    if (!response.ok) {
      const retryable = isRetryableHttpStatus(response.status, retryStatusCodes);
      const blockedAt = new Date();
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode,
        status: 'blocked',
        boundary: 'http_adapter',
        method,
        url: redactUrl(url),
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        httpStatus: response.status,
        reason: readString((asRecord(responseBody)).message) || response.statusText || `http_${response.status}`,
        retryable,
        attempt,
        maxAttempts,
        attemptsExhausted: attempt >= maxAttempts,
        blockedAt: blockedAt.toISOString(),
        ...buildHttpAutoRetryMetadata(
          provisioningConfig,
          request,
          retryable,
          context,
          blockedAt,
        ),
      }, provisioningRun);
    }

    const responseRecord = asRecord(responseBody);
    const deliverySource = resolveHttpProvisioningDeliverySource(responseRecord);
    const split = splitDeliveryAndCredentials(deliverySource, resourceType.deliverySchema);
    const adapterConfig = asRecord(responseRecord.config);
    const createInstance = readBoolean(responseRecord.createInstance, readBoolean(provisioningConfig.createInstanceOnSuccess, true));
    const shouldCreateInstance = createInstance && (
      hasRecordValues(split.delivery)
      || hasRecordValues(split.credentials)
      || hasRecordValues(adapterConfig)
    );
    const providerRunId = readString(responseRecord.providerRunId)
      || readString(responseRecord.runId)
      || readString(responseRecord.id);
    const completedAt = new Date().toISOString();
    const completedProvisioning = {
      mode,
      status: 'completed',
      boundary: 'http_adapter',
      provisioningRunId: provisioningRun.id,
      replayOfRunId: context.replayOfRunId,
      method,
      url: redactUrl(url),
      httpStatus: response.status,
      idempotencyKey,
      credentialRef: credentialRef || undefined,
      providerRunId: providerRunId || undefined,
      attempt,
      maxAttempts,
      responseKeys: Object.keys(responseRecord),
      deliveryKeys: Object.keys(split.delivery),
      credentialKeys: Object.keys(split.credentials),
      createInstance: shouldCreateInstance,
      completedAt,
    };
    const completion = await this.statusWriter.completeProvisionedRequest(teamId, userId, request, {
      createInstance: shouldCreateInstance,
      instanceName: (
        readString(responseRecord.instanceName)
        || readString(responseRecord.resourceName)
        || resolveRequestedResourceName(request.spec)
        || (request.title as string)
      ),
      config: {
        ...adapterConfig,
        provisioningMode: mode,
        adapter: mode,
        endpoint: redactUrl(url),
        providerRunId: providerRunId || undefined,
        credentialRef: credentialRef || undefined,
      },
      delivery: split.delivery,
      credentials: split.credentials,
      provisioning: completedProvisioning,
      auditMetadata: {
        createInstance: shouldCreateInstance,
        provisioningMode: mode,
        boundary: 'http_adapter',
        method,
        url: redactUrl(url),
        httpStatus: response.status,
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        providerRunId: providerRunId || undefined,
        provisioningRunId: provisioningRun.id,
        attempt,
        maxAttempts,
        responseKeys: Object.keys(responseRecord),
      },
    });

    await this.runWriter.finishProvisioningRun(provisioningRun, completedProvisioning);

    return completion.request;
  }

  private async provisionWithProviderAdapter(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
    context: ProvisioningProcessorContext,
  ) {
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const provider = readString(provisioningConfig.provider) || readString(provisioningConfig.providerKey);
    const operation = (
      readString(provisioningConfig.operation)
      || readString(provisioningConfig.action)
      || `provision.${resourceType.key}`
    );
    const spec = asRecord(request.spec);
    const region = readString(provisioningConfig.region) || readString(spec.region);
    const idempotencyKey = buildProvisioningIdempotencyKey(request, resourceType, 'provider', provisioningConfig);
    const maxAttempts = readProviderMaxAttempts(provisioningConfig);
    const adapterKey = resolveProviderAdapterKey(provider, provisioningConfig);
    const executorKey = readString(provisioningConfig.executorKey) || 'cloud-sdk';
    const dryRun = readBoolean(provisioningConfig.dryRun, true);
    const providerState = readProviderProvisioningState(provisioningConfig);
    const providerStateStatus = readProviderStateStatus(providerState);
    const providerStateSummary = redactSensitiveRecord(providerState);
    const plan = buildProviderProvisioningPlan({
      request,
      resourceType,
      provider,
      operation,
      region,
      idempotencyKey,
      executorKey,
      adapterKey,
      dryRun,
      providerState,
    });
    const provisioningRun = await this.runWriter.createProvisioningRun(
      teamId,
      userId,
      request,
      resourceType,
      'provider',
      context,
      provisioningConfig,
      {
        method: operation,
        idempotencyKey,
        maxAttempts,
        queue: { enabled: false, delaySeconds: 0 },
        boundary: 'provider_sdk_adapter',
        executorKey,
        adapterKey,
        params: {
          provider: provider || undefined,
          operation,
          region: region || undefined,
          dryRun,
          providerStateStatus: providerStateStatus || undefined,
          providerState: hasRecordValues(providerStateSummary) ? providerStateSummary : undefined,
        },
      },
    );

    if (!provider) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode: 'provider',
        status: 'blocked',
        boundary: 'provider_sdk_adapter',
        executorKey,
        adapterKey,
        operation,
        idempotencyKey,
        reason: 'missing_provider',
        plan,
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    let credentialRef: ProvisioningCredentialRef | null;
    try {
      credentialRef = await this.resolveProvisioningCredentialRef(teamId, provisioningConfig);
    } catch (error) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode: 'provider',
        status: 'blocked',
        boundary: 'provider_sdk_adapter',
        provider,
        operation,
        region: region || undefined,
        executorKey,
        adapterKey,
        idempotencyKey,
        reason: errorMessage(error),
        plan,
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }
    await this.runWriter.attachProvisioningRunCredentialRef(provisioningRun, credentialRef);

    if (providerStateIndicatesCompleted(providerState)) {
      const deliverySource = resolveProviderProvisioningDeliverySource(providerState, provisioningConfig);
      const split = splitDeliveryAndCredentials(deliverySource, resourceType.deliverySchema);
      const adapterConfig = {
        ...asRecord(asRecord(providerState).config),
        ...asRecord(provisioningConfig.instanceConfig),
      };
      const createInstance = readBoolean(
        providerState.createInstance,
        readBoolean(provisioningConfig.createInstanceOnSuccess, true),
      );
      const shouldCreateInstance = createInstance && (
        hasRecordValues(split.delivery)
        || hasRecordValues(split.credentials)
        || hasRecordValues(adapterConfig)
      );
      const providerRunId = resolveProviderRunId(providerState, provisioningConfig, idempotencyKey);
      const completedAt = new Date().toISOString();
      const completedProvisioning = {
        mode: 'provider',
        status: 'completed',
        boundary: 'provider_sdk_adapter',
        provisioningRunId: provisioningRun.id,
        replayOfRunId: context.replayOfRunId,
        provider,
        operation,
        region: region || undefined,
        executorKey,
        adapterKey,
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        providerRunId,
        providerStateStatus: providerStateStatus || undefined,
        providerState: hasRecordValues(providerStateSummary) ? providerStateSummary : undefined,
        deliveryKeys: Object.keys(split.delivery),
        credentialKeys: Object.keys(split.credentials),
        createInstance: shouldCreateInstance,
        recoveredFromProviderState: true,
        completedAt,
      };
      const completion = await this.statusWriter.completeProvisionedRequest(teamId, userId, request, {
        createInstance: shouldCreateInstance,
        instanceName: (
          readString(providerState.instanceName)
          || readString(providerState.resourceName)
          || resolveRequestedResourceName(request.spec)
          || (request.title as string)
        ),
        config: {
          ...adapterConfig,
          provisioningMode: 'provider',
          adapter: 'provider',
          provider,
          operation,
          region: region || undefined,
          providerRunId,
          credentialRef: credentialRef || undefined,
        },
        delivery: split.delivery,
        credentials: split.credentials,
        provisioning: completedProvisioning,
        auditMetadata: {
          createInstance: shouldCreateInstance,
          provisioningMode: 'provider',
          boundary: 'provider_sdk_adapter',
          provider,
          operation,
          region: region || undefined,
          idempotencyKey,
          credentialRef: credentialRef || undefined,
          providerRunId,
          providerStateStatus: providerStateStatus || undefined,
          provisioningRunId: provisioningRun.id,
          recoveredFromProviderState: true,
        },
      });

      await this.runWriter.finishProvisioningRun(provisioningRun, completedProvisioning);
      return completion.request;
    }

    if (dryRun) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode: 'provider',
        status: 'planned',
        boundary: 'provider_sdk_adapter',
        provider,
        operation,
        region: region || undefined,
        executorKey,
        adapterKey,
        idempotencyKey,
        credentialRef: credentialRef || undefined,
        providerStateStatus: providerStateStatus || undefined,
        providerState: hasRecordValues(providerStateSummary) ? providerStateSummary : undefined,
        reason: 'provider_sdk_plan_ready',
        requiresManualCompletion: true,
        plan,
        plannedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
      mode: 'provider',
      status: 'blocked',
      boundary: 'provider_sdk_adapter',
      provider,
      operation,
      region: region || undefined,
      executorKey,
      adapterKey,
      idempotencyKey,
      credentialRef: credentialRef || undefined,
      providerStateStatus: providerStateStatus || undefined,
      providerState: hasRecordValues(providerStateSummary) ? providerStateSummary : undefined,
      reason: 'provider_sdk_live_transport_disabled',
      retryable: false,
      plan,
      blockedAt: new Date().toISOString(),
    }, provisioningRun);
  }

  private httpProvisioningEnabled() {
    return readBoolean(this.configService.get('RESOURCE_PROVISIONING_HTTP_ENABLED', false), false);
  }

  private httpProvisioningQueueEnabled() {
    return readBoolean(
      this.configService.get('RESOURCE_REQUEST_PROVISIONING_HTTP_QUEUE_ENABLED', false),
      false,
    );
  }

  private async markProviderStatePollingPending(
    run: ResourceProvisioningRunRecord,
    request: JsonRecord,
    currentProvisioning: JsonRecord,
    config: ProviderStatePollingConfig,
    attempt: number,
    now: Date,
    nextAvailableAt: Date,
    reason: string,
    source?: string,
  ) {
    const runParams = asRecord(run.params);
    const providerPolling = buildProviderStatePollingMetadata(config, attempt, now, nextAvailableAt, {
      source,
      stateFound: false,
      reason,
    });
    const provisioning = {
      ...currentProvisioning,
      mode: 'provider',
      status: 'planned',
      boundary: run.boundary || 'provider_sdk_adapter',
      provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
      provider: readString(currentProvisioning.provider) || readString(runParams.provider) || undefined,
      operation: readString(currentProvisioning.operation) || readString(runParams.operation) || undefined,
      region: readString(currentProvisioning.region) || readString(runParams.region) || undefined,
      executorKey: run.executorKey || currentProvisioning.executorKey,
      adapterKey: run.adapterKey || currentProvisioning.adapterKey,
      idempotencyKey: run.idempotencyKey || currentProvisioning.idempotencyKey,
      providerRunId: run.providerRunId || currentProvisioning.providerRunId,
      reason,
      retryable: false,
      requiresManualCompletion: true,
      providerPolling,
      updatedAt: now.toISOString(),
    };

    await this.repo.updateRun({
      where: { id: run.id },
      data: {
        status: 'planned',
        attempt,
        maxAttempts: config.maxAttempts,
        retryable: false,
        result: {
          ...asRecord(run.result),
          provisioning,
        },
        error: reason,
        availableAt: nextAvailableAt,
        lockedAt: null,
        lockOwner: null,
        finishedAt: now,
      },
    });

    await this.statusWriter.writeAudit({
      teamId: run.teamId as string,
      resourceTypeId: run.resourceTypeId as string,
      requestId: request.id as string,
      provisioningRunId: run.id as string,
      action: 'provisioning.provider_state_poll_waiting',
      message: 'provider SDK 交付状态轮询仍在等待结果',
      metadata: provisioning,
    });
  }

  private async updateProviderStatePollingMetadata(
    run: ResourceProvisioningRunRecord,
    provisioning: JsonRecord,
    config: ProviderStatePollingConfig,
    attempt: number,
    now: Date,
    nextAvailableAt: Date,
    source?: string,
  ) {
    const providerState = asRecord(provisioning.providerState);
    const providerPolling = buildProviderStatePollingMetadata(config, attempt, now, nextAvailableAt, {
      source,
      stateFound: hasRecordValues(providerState),
      providerStateStatus: readString(provisioning.providerStateStatus) || undefined,
      reason: readString(provisioning.reason) || undefined,
    });
    await this.repo.updateRun({
      where: { id: run.id },
      data: {
        status: 'planned',
        attempt,
        maxAttempts: config.maxAttempts,
        retryable: false,
        result: {
          ...asRecord(run.result),
          provisioning: {
            ...provisioning,
            providerPolling,
          },
        },
        error: readString(provisioning.reason) || null,
        availableAt: nextAvailableAt,
        lockedAt: null,
        lockOwner: null,
        finishedAt: now,
      },
    });
  }

  private async blockProviderStatePollingRun(
    run: ResourceProvisioningRunRecord,
    request: JsonRecord,
    currentProvisioning: JsonRecord,
    config: ProviderStatePollingConfig,
    attempt: number,
    now: Date,
    reason: string,
  ) {
    return this.runWriter.markProvisioningStatusWithRun(run.teamId as string, undefined, request, {
      ...currentProvisioning,
      mode: 'provider',
      status: 'blocked',
      boundary: run.boundary || 'provider_sdk_adapter',
      provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
      idempotencyKey: run.idempotencyKey || currentProvisioning.idempotencyKey,
      providerRunId: run.providerRunId || currentProvisioning.providerRunId,
      reason,
      retryable: false,
      providerPolling: buildProviderStatePollingMetadata(config, attempt, now, null, {
        stateFound: false,
        reason,
      }),
      blockedAt: now.toISOString(),
    }, run);
  }

  private async markProviderStatePollingError(
    run: ResourceProvisioningRunRecord,
    request: JsonRecord,
    currentProvisioning: JsonRecord,
    config: ProviderStatePollingConfig,
    attempt: number,
    now: Date,
    nextAvailableAt: Date,
    reason: string,
  ) {
    if (attempt >= config.maxAttempts) {
      await this.blockProviderStatePollingRun(
        run,
        request,
        currentProvisioning,
        config,
        attempt,
        now,
        reason,
      );
      return;
    }

    const providerPolling = buildProviderStatePollingMetadata(config, attempt, now, nextAvailableAt, {
      stateFound: false,
      reason,
    });
    await this.repo.updateRun({
      where: { id: run.id },
      data: {
        status: 'planned',
        attempt,
        maxAttempts: config.maxAttempts,
        retryable: true,
        result: {
          ...asRecord(run.result),
          provisioning: {
            ...currentProvisioning,
            providerPolling,
          },
        },
        error: reason,
        availableAt: nextAvailableAt,
        lockedAt: null,
        lockOwner: null,
        finishedAt: now,
      },
    });

    this.logger.warn(`ResourceRequest providerState polling failed: ${reason}`);
  }

  private async resolveProvisioningCredentialRef(
    teamId: string,
    config: JsonRecord,
  ): Promise<ProvisioningCredentialRef | null> {
    const auth = asRecord(config.auth);
    const credential = asRecord(config.credential);
    const credentialId = (
      readString(config.credentialId)
      || readString(auth.credentialId)
      || readString(credential.id)
    );
    const credentialRequired = readBoolean(config.requireCredential, readBoolean(auth.required, false));

    if (!credentialId) {
      if (credentialRequired) {
        throw new BadRequestException('外部资源交付需要绑定 TeamCredential');
      }
      return null;
    }

    const record = await this.repo.findTeamCredential({
      where: { id: credentialId, teamId },
      select: { id: true, name: true, type: true },
    });

    if (!record) {
      throw new NotFoundException('TeamCredential 不存在或不属于当前团队');
    }

    const allowedTypes = readCredentialTypeAllowList(config, auth);
    if (allowedTypes.length > 0 && !allowedTypes.includes(record.type)) {
      throw new BadRequestException('TeamCredential 类型与外部资源交付 adapter 不匹配');
    }

    return {
      source: 'team_credential',
      referenceId: record.id,
      displayName: record.name,
      credentialType: record.type,
      authAdapterKey: resolveAuthAdapterKey(record.type, auth),
      redacted: true,
    };
  }

  private readStaleProvisioningRunAfterSeconds(value?: unknown) {
    const configured = readPositiveInteger(
      this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS', '1800'),
    ) || 1800;
    return Math.max(readPositiveInteger(value) || configured, 60);
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
