/**
 * Provider-state run writers.
 *
 * Holds the four polling-state writers (pending / metadata-update / block /
 * error) and the provider-state reconcile applier, extracted from
 * `ResourceProviderStateService` so that service stays under the 200-line
 * ceiling. Behavior preserved verbatim — identical repository / writer / audit
 * calls and metadata shapes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceProvisioningRunWriterService } from './resource-provisioning-run-writer.service';
import { ReconcileProviderResourceProvisioningRunDto } from './dto/resource-request.dto';
import {
  JsonRecord,
  ProviderStatePollingConfig,
  ProvisioningResourceType,
  ResourceProvisioningRunRecord,
} from './resource-request.types';
import {
  asRecord,
  hasRecordValues,
  readBoolean,
  readString,
} from './resource-provisioning-value.utils';
import {
  redactSensitiveRecord,
  resolveRequestedResourceName,
  splitDeliveryAndCredentials,
} from './resource-provisioning-sensitive.utils';
import { buildProvisioningIdempotencyKey } from './resource-provisioning-http-config.utils';
import {
  buildProviderStatePollingMetadata,
  resolveProviderAdapterKey,
} from './resource-provisioning-provider-config.utils';
import {
  providerStateIndicatesCompleted,
  providerStateIndicatesFailed,
  readProviderStateReason,
  readProviderStateStatus,
  resolveProviderProvisioningDeliverySource,
  resolveProviderRunId,
  resolveRunCredentialRef,
} from './resource-provisioning-provider-state.utils';

@Injectable()
export class ResourceProviderStateWriterService {
  private readonly logger = new Logger(ResourceProviderStateWriterService.name);

  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly runWriter: ResourceProvisioningRunWriterService,
  ) {}

  async applyProviderStateReconcile(input: {
    teamId: string; userId: string | undefined; existing: JsonRecord;
    run: ResourceProvisioningRunRecord; runStatus: string;
    resourceType: ProvisioningResourceType; providerState: JsonRecord;
    dto: ReconcileProviderResourceProvisioningRunDto;
  }) {
    const { teamId, userId, existing, run, runStatus, resourceType, providerState, dto } = input;
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const runParams = asRecord(run.params);
    const provider = readString(providerState.provider) || readString(runParams.provider) || readString(provisioningConfig.provider) || readString(provisioningConfig.providerKey);
    const operation = readString(providerState.operation) || readString(runParams.operation) || readString(provisioningConfig.operation) || readString(provisioningConfig.action) || `provision.${resourceType.key}`;
    const region = readString(providerState.region) || readString(runParams.region) || readString(provisioningConfig.region) || readString(asRecord(existing.spec).region);
    const idempotencyKey = readString(run.idempotencyKey) || buildProvisioningIdempotencyKey(existing, resourceType, 'provider', provisioningConfig);
    const executorKey = readString(run.executorKey) || readString(provisioningConfig.executorKey) || 'cloud-sdk';
    const adapterKey = readString(run.adapterKey) || resolveProviderAdapterKey(provider, provisioningConfig);
    const providerStateStatus = readProviderStateStatus(providerState);
    const providerStateSummary = redactSensitiveRecord(providerState);
    const providerRunId = resolveProviderRunId(providerState, { ...provisioningConfig, ...runParams }, idempotencyKey);
    const credentialRef = resolveRunCredentialRef(run, asRecord(asRecord(existing.result).provisioning));
    const reconciledAt = new Date().toISOString();
    const baseProvisioning = {
      mode: 'provider', boundary: 'provider_sdk_adapter', provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined, provider: provider || undefined, operation,
      region: region || undefined, executorKey, adapterKey, idempotencyKey,
      credentialRef: credentialRef || undefined, providerRunId,
      providerStateStatus: providerStateStatus || undefined, providerState: providerStateSummary,
      reconciledAt, reconciledBy: userId,
    };
    await this.statusWriter.writeAudit({
      teamId, actorId: userId, resourceTypeId: existing.resourceTypeId as string,
      requestId: existing.id as string, provisioningRunId: run.id as string,
      action: 'provisioning.provider_state_reconciled', message: '对账 provider SDK 交付运行状态',
      metadata: { ...baseProvisioning, previousStatus: runStatus },
    });

    if (providerStateIndicatesCompleted(providerState)) {
      const deliverySource = resolveProviderProvisioningDeliverySource(providerState, provisioningConfig);
      const split = splitDeliveryAndCredentials(deliverySource, resourceType.deliverySchema);
      const adapterConfig = { ...asRecord(asRecord(providerState).config), ...asRecord(provisioningConfig.instanceConfig) };
      const createInstance = readBoolean(dto.createInstance, readBoolean(providerState.createInstance, readBoolean(provisioningConfig.createInstanceOnSuccess, true)));
      const shouldCreateInstance = createInstance && (hasRecordValues(split.delivery) || hasRecordValues(split.credentials) || hasRecordValues(adapterConfig));
      const completedProvisioning = { ...baseProvisioning, status: 'completed',
        deliveryKeys: Object.keys(split.delivery), credentialKeys: Object.keys(split.credentials),
        createInstance: shouldCreateInstance, recoveredFromProviderState: true, completedAt: reconciledAt };
      const completion = await this.statusWriter.completeProvisionedRequest(teamId, userId, existing, {
        createInstance: shouldCreateInstance,
        instanceName: readString(dto.instanceName) || readString(providerState.instanceName) || readString(providerState.resourceName) || resolveRequestedResourceName(existing.spec) || (existing.title as string),
        config: { ...adapterConfig, provisioningMode: 'provider', adapter: 'provider', provider: provider || undefined, operation, region: region || undefined, providerRunId, credentialRef: credentialRef || undefined },
        delivery: split.delivery, credentials: split.credentials, provisioning: completedProvisioning,
        auditMetadata: { createInstance: shouldCreateInstance, provisioningMode: 'provider', boundary: 'provider_sdk_adapter',
          provider: provider || undefined, operation, region: region || undefined, idempotencyKey,
          credentialRef: credentialRef || undefined, providerRunId, providerStateStatus: providerStateStatus || undefined,
          provisioningRunId: run.id as string, recoveredFromProviderState: true, reconciledAt },
      });
      await this.runWriter.finishProvisioningRun(run, completedProvisioning);
      return completion.request;
    }

    const failed = providerStateIndicatesFailed(providerState);
    const status = failed ? 'blocked' : 'planned';
    return this.runWriter.markProvisioningStatusWithRun(teamId, userId, existing, {
      ...baseProvisioning, status,
      reason: failed ? readProviderStateReason(providerState) : 'provider_state_pending',
      retryable: false, requiresManualCompletion: !failed, updatedAt: reconciledAt,
    }, run);
  }

  async markProviderStatePollingPending(run: ResourceProvisioningRunRecord, request: JsonRecord, currentProvisioning: JsonRecord, config: ProviderStatePollingConfig, attempt: number, now: Date, nextAvailableAt: Date, reason: string, source?: string) {
    const runParams = asRecord(run.params);
    const providerPolling = buildProviderStatePollingMetadata(config, attempt, now, nextAvailableAt, { source, stateFound: false, reason });
    const provisioning = {
      ...currentProvisioning, mode: 'provider', status: 'planned',
      boundary: run.boundary || 'provider_sdk_adapter', provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
      provider: readString(currentProvisioning.provider) || readString(runParams.provider) || undefined,
      operation: readString(currentProvisioning.operation) || readString(runParams.operation) || undefined,
      region: readString(currentProvisioning.region) || readString(runParams.region) || undefined,
      executorKey: run.executorKey || currentProvisioning.executorKey,
      adapterKey: run.adapterKey || currentProvisioning.adapterKey,
      idempotencyKey: run.idempotencyKey || currentProvisioning.idempotencyKey,
      providerRunId: run.providerRunId || currentProvisioning.providerRunId,
      reason, retryable: false, requiresManualCompletion: true, providerPolling, updatedAt: now.toISOString(),
    };
    await this.repo.updateRun({
      where: { id: run.id },
      data: { status: 'planned', attempt, maxAttempts: config.maxAttempts, retryable: false,
        result: { ...asRecord(run.result), provisioning }, error: reason, availableAt: nextAvailableAt,
        lockedAt: null, lockOwner: null, finishedAt: now },
    });
    await this.statusWriter.writeAudit({
      teamId: run.teamId as string, resourceTypeId: run.resourceTypeId as string,
      requestId: request.id as string, provisioningRunId: run.id as string,
      action: 'provisioning.provider_state_poll_waiting', message: 'provider SDK 交付状态轮询仍在等待结果', metadata: provisioning,
    });
  }

  async updateProviderStatePollingMetadata(run: ResourceProvisioningRunRecord, provisioning: JsonRecord, config: ProviderStatePollingConfig, attempt: number, now: Date, nextAvailableAt: Date, source?: string) {
    const providerState = asRecord(provisioning.providerState);
    const providerPolling = buildProviderStatePollingMetadata(config, attempt, now, nextAvailableAt, {
      source, stateFound: hasRecordValues(providerState),
      providerStateStatus: readString(provisioning.providerStateStatus) || undefined,
      reason: readString(provisioning.reason) || undefined,
    });
    await this.repo.updateRun({
      where: { id: run.id },
      data: { status: 'planned', attempt, maxAttempts: config.maxAttempts, retryable: false,
        result: { ...asRecord(run.result), provisioning: { ...provisioning, providerPolling } },
        error: readString(provisioning.reason) || null, availableAt: nextAvailableAt,
        lockedAt: null, lockOwner: null, finishedAt: now },
    });
  }

  async blockProviderStatePollingRun(run: ResourceProvisioningRunRecord, request: JsonRecord, currentProvisioning: JsonRecord, config: ProviderStatePollingConfig, attempt: number, now: Date, reason: string) {
    return this.runWriter.markProvisioningStatusWithRun(run.teamId as string, undefined, request, {
      ...currentProvisioning, mode: 'provider', status: 'blocked',
      boundary: run.boundary || 'provider_sdk_adapter', provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
      idempotencyKey: run.idempotencyKey || currentProvisioning.idempotencyKey,
      providerRunId: run.providerRunId || currentProvisioning.providerRunId,
      reason, retryable: false,
      providerPolling: buildProviderStatePollingMetadata(config, attempt, now, null, { stateFound: false, reason }),
      blockedAt: now.toISOString(),
    }, run);
  }

  async markProviderStatePollingError(run: ResourceProvisioningRunRecord, request: JsonRecord, currentProvisioning: JsonRecord, config: ProviderStatePollingConfig, attempt: number, now: Date, nextAvailableAt: Date, reason: string) {
    if (attempt >= config.maxAttempts) {
      await this.blockProviderStatePollingRun(run, request, currentProvisioning, config, attempt, now, reason);
      return;
    }
    const providerPolling = buildProviderStatePollingMetadata(config, attempt, now, nextAvailableAt, { stateFound: false, reason });
    await this.repo.updateRun({
      where: { id: run.id },
      data: { status: 'planned', attempt, maxAttempts: config.maxAttempts, retryable: true,
        result: { ...asRecord(run.result), provisioning: { ...currentProvisioning, providerPolling } },
        error: reason, availableAt: nextAvailableAt, lockedAt: null, lockOwner: null, finishedAt: now },
    });
    this.logger.warn(`ResourceRequest providerState polling failed: ${reason}`);
  }
}
