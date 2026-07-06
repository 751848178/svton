/**
 * ResourceRequestService — public facade.
 *
 * Thin delegation layer over the focused resource-request services:
 * - ResourceTypeService (CRUD + default seed)
 * - ResourceRequestAccessService (project / environment / type guards + access-scope)
 * - ResourceRequestLifecycleService (request create / list / get / review / complete / retry / cancel)
 * - ResourceRequestInstanceService (instance list / get / release / credential-for-generation + audit-log read)
 * - ResourceRequestProvisioningService (5 provisioning adapters + dispatch + retry/replay)
 * - ResourceRequestRecoveryService (auto-retry, queue-worker entry, supervisor, replay)
 * - ResourceProviderStateService (providerState reconcile + polling)
 *
 * This facade preserves the original public API consumed by the controller and
 * scheduler; all behavior lives in the focused services. No business logic here.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestAccessService } from './resource-request-access.service';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceProvisioningRunWriterService } from './resource-provisioning-run-writer.service';
import { ResourceRequestProvisioningService } from './resource-request-provisioning.service';
import { ResourceRequestRecoveryService } from './resource-request-recovery.service';
import { ResourceProviderStateService } from './resource-provider-state.service';
import { ResourceRequestLifecycleService } from './resource-request-lifecycle.service';
import { ResourceRequestInstanceService } from './resource-request-instance.service';
import { ResourceTypeService } from './resource-type.service';
import { serializeProvisioningRun } from './resource-provisioning-run-serialize.utils';
import { ResourceProvisioningRunSupervisorService } from './resource-provisioning-run-supervisor.service';
import { ResourceProvisioningRunReadService } from './resource-provisioning-run-read.service';
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
import { JsonRecord } from './resource-request.types';

@Injectable()
export class ResourceRequestService implements OnModuleInit {
  constructor(
    private readonly resourceTypeService: ResourceTypeService,
    private readonly accessService: ResourceRequestAccessService,
    private readonly provisioning: ResourceRequestProvisioningService,
    private readonly recovery: ResourceRequestRecoveryService,
    private readonly providerState: ResourceProviderStateService,
    private readonly lifecycle: ResourceRequestLifecycleService,
    private readonly instance: ResourceRequestInstanceService,
    private readonly provisioningRunReadService: ResourceProvisioningRunReadService,
  ) {}

  async onModuleInit() {
    await this.resourceTypeService.ensureDefaults();
  }

  createResourceType = (userId: string, dto: CreateResourceTypeDto) =>
    this.resourceTypeService.createResourceType(userId, dto);
  listResourceTypes = (includeDisabled = false) =>
    this.resourceTypeService.listResourceTypes(includeDisabled);
  getResourceType = (id: string) => this.resourceTypeService.getResourceType(id);
  updateResourceType = (id: string, dto: UpdateResourceTypeDto) =>
    this.resourceTypeService.updateResourceType(id, dto);
  disableResourceType = (id: string) => this.resourceTypeService.disableResourceType(id);

  resolveRequestInputAccessScope = (teamId: string, dto: CreateResourceRequestDto) =>
    this.accessService.resolveRequestInputAccessScope(teamId, dto);
  getRequestAccessScope = (teamId: string, id: string) =>
    this.accessService.getRequestAccessScope(teamId, id);
  getInstanceAccessScope = (teamId: string, id: string) =>
    this.accessService.getInstanceAccessScope(teamId, id);

  createRequest = (teamId: string, userId: string, dto: CreateResourceRequestDto) =>
    this.lifecycle.createRequest(teamId, userId, dto);
  listRequests = (teamId: string, query: ListResourceRequestsQueryDto) =>
    this.lifecycle.listRequests(teamId, query);
  getRequest = (teamId: string, id: string) => this.lifecycle.getRequest(teamId, id);
  reviewRequest = (teamId: string, userId: string, id: string, dto: ReviewResourceRequestDto) =>
    this.lifecycle.reviewRequest(teamId, userId, id, dto);
  completeRequest = (teamId: string, userId: string, id: string, dto: CompleteResourceRequestDto) =>
    this.lifecycle.completeRequest(teamId, userId, id, dto);
  retryProvisioning = (teamId: string, userId: string, id: string) =>
    this.lifecycle.retryProvisioning(teamId, userId, id);
  cancelRequest = (teamId: string, userId: string, id: string) =>
    this.lifecycle.cancelRequest(teamId, userId, id);

  listInstances = (teamId: string, query: ListResourceInstancesQueryDto) =>
    this.instance.listInstances(teamId, query);
  getInstance = (teamId: string, id: string) => this.instance.getInstance(teamId, id);
  getInstanceCredentialForGeneration = (teamId: string, id: string) =>
    this.instance.getInstanceCredentialForGeneration(teamId, id);
  releaseInstance = (teamId: string, userId: string, id: string) =>
    this.instance.releaseInstance(teamId, userId, id);
  listAuditLogs = (teamId: string, query: ListResourceAuditLogsQueryDto) =>
    this.instance.listAuditLogs(teamId, query);

  async listProvisioningRuns(teamId: string, requestId: string, query: ListResourceProvisioningRunsQueryDto) {
    return this.provisioningRunReadService.listRuns(
      teamId, requestId, query, (run) => serializeProvisioningRun(run as JsonRecord),
    );
  }

  replayProvisioningRun = (teamId: string, userId: string, requestId: string, runId: string) =>
    this.recovery.replayProvisioningRun(teamId, userId, requestId, runId);
  getProvisioningRunSupervisor = (teamId: string, query: ResourceProvisioningRunSupervisorQueryDto = {}) =>
    this.recovery.getProvisioningRunSupervisor(teamId, query);
  recoverTeamStaleProvisioningRuns = (teamId: string, dto: RecoverStaleResourceProvisioningRunsDto = {}) =>
    this.recovery.recoverTeamStaleProvisioningRuns(teamId, dto);
  processNextQueuedProvisioningRun = (
    teamId: string | undefined, userId: string | undefined, dto: ProcessQueuedResourceProvisioningRunDto = {},
  ) => this.recovery.processNextQueuedProvisioningRun(teamId, userId, dto);
  processDueProvisioningAutoRetries = (options: { limit?: number; now?: Date } = {}) =>
    this.recovery.processDueProvisioningAutoRetries(options);
  recoverStaleProvisioningRuns = (
    options: { teamId?: string; limit?: number; now?: Date; staleAfterSeconds?: number } = {},
  ) => this.recovery.recoverStaleProvisioningRuns(options);

  processDueProviderStatePollingRuns = (options: { limit?: number; now?: Date } = {}) =>
    this.providerState.processDueProviderStatePollingRuns(options);
  reconcileProviderProvisioningRun = (
    teamId: string, userId: string | undefined, requestId: string, runId: string,
    dto: ReconcileProviderResourceProvisioningRunDto,
  ) => this.providerState.reconcileProviderProvisioningRun(teamId, userId, requestId, runId, dto);
}
