/**
 * Provider SDK provisioning adapter.
 *
 * Builds a provider SDK plan, creates a provisioning run, and either completes
 * the request from an existing providerState (idempotent recovery), writes a
 * dry-run plan, or blocks on missing live transport. Extracted verbatim from
 * the original `provisionWithProviderAdapter` in `ResourceRequestService`.
 * No behavior change.
 */

import { Injectable } from '@nestjs/common';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceProvisioningRunWriterService } from './resource-provisioning-run-writer.service';
import { ResourceRequestCredentialRefService } from './resource-request-credential-ref.service';
import {
  JsonRecord,
  ProvisioningProcessorContext,
  ProvisioningResourceType,
  ResourceProvisioningRunRecord,
} from './resource-request.types';
import {
  asRecord,
  errorMessage,
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
  readProviderMaxAttempts,
  readProviderProvisioningState,
  resolveProviderAdapterKey,
} from './resource-provisioning-provider-config.utils';
import {
  buildProviderProvisioningPlan,
  providerStateIndicatesCompleted,
  readProviderStateStatus,
  resolveProviderProvisioningDeliverySource,
  resolveProviderRunId,
} from './resource-provisioning-provider-state.utils';
@Injectable()
export class ResourceRequestProviderProvisioningService {
  constructor(
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly runWriter: ResourceProvisioningRunWriterService,
    private readonly credentialRef: ResourceRequestCredentialRefService,
  ) {}

  async provisionWithProviderAdapter(
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
      request, resourceType, provider, operation, region, idempotencyKey, executorKey, adapterKey, dryRun,
      providerState,
    });
    const provisioningRun = await this.runWriter.createProvisioningRun(
      teamId, userId, request, resourceType, 'provider', context, provisioningConfig,
      {
        method: operation, idempotencyKey, maxAttempts, queue: { enabled: false, delaySeconds: 0 },
        boundary: 'provider_sdk_adapter', executorKey, adapterKey,
        params: {
          provider: provider || undefined, operation, region: region || undefined, dryRun,
          providerStateStatus: providerStateStatus || undefined,
          providerState: hasRecordValues(providerStateSummary) ? providerStateSummary : undefined,
        },
      },
    );

    if (!provider) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode: 'provider', status: 'blocked', boundary: 'provider_sdk_adapter',
        executorKey, adapterKey, operation, idempotencyKey, reason: 'missing_provider', plan,
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    let credentialRef;
    try {
      credentialRef = await this.credentialRef.resolveProvisioningCredentialRef(teamId, provisioningConfig);
    } catch (error) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode: 'provider', status: 'blocked', boundary: 'provider_sdk_adapter',
        provider, operation, region: region || undefined, executorKey, adapterKey, idempotencyKey,
        reason: errorMessage(error), plan, blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }
    await this.runWriter.attachProvisioningRunCredentialRef(provisioningRun, credentialRef);

    if (providerStateIndicatesCompleted(providerState)) {
      return this.completeProviderFromState({
        teamId, userId, request, resourceType, context, provisioningRun, provisioningConfig,
        provider, operation, region, executorKey, adapterKey, idempotencyKey,
        providerState, providerStateStatus, providerStateSummary, credentialRef,
      });
    }

    if (dryRun) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode: 'provider', status: 'planned', boundary: 'provider_sdk_adapter',
        provider, operation, region: region || undefined, executorKey, adapterKey, idempotencyKey,
        credentialRef: credentialRef || undefined,
        providerStateStatus: providerStateStatus || undefined,
        providerState: hasRecordValues(providerStateSummary) ? providerStateSummary : undefined,
        reason: 'provider_sdk_plan_ready', requiresManualCompletion: true, plan,
        plannedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
      mode: 'provider', status: 'blocked', boundary: 'provider_sdk_adapter',
      provider, operation, region: region || undefined, executorKey, adapterKey, idempotencyKey,
      credentialRef: credentialRef || undefined,
      providerStateStatus: providerStateStatus || undefined,
      providerState: hasRecordValues(providerStateSummary) ? providerStateSummary : undefined,
      reason: 'provider_sdk_live_transport_disabled', retryable: false, plan,
      blockedAt: new Date().toISOString(),
    }, provisioningRun);
  }

  private async completeProviderFromState(input: {
    teamId: string; userId: string | undefined; request: JsonRecord;
    resourceType: ProvisioningResourceType; context: ProvisioningProcessorContext;
    provisioningRun: ResourceProvisioningRunRecord; provisioningConfig: JsonRecord;
    provider: string; operation: string; region: string;
    executorKey: string; adapterKey: string; idempotencyKey: string;
    providerState: JsonRecord; providerStateStatus: string; providerStateSummary: JsonRecord;
    credentialRef: unknown;
  }) {
    const { teamId, userId, request, resourceType, context, provisioningRun, provisioningConfig } = input;
    const deliverySource = resolveProviderProvisioningDeliverySource(input.providerState, provisioningConfig);
    const split = splitDeliveryAndCredentials(deliverySource, resourceType.deliverySchema);
    const adapterConfig = {
      ...asRecord(asRecord(input.providerState).config),
      ...asRecord(provisioningConfig.instanceConfig),
    };
    const createInstance = readBoolean(
      input.providerState.createInstance,
      readBoolean(provisioningConfig.createInstanceOnSuccess, true),
    );
    const shouldCreateInstance = createInstance && (
      hasRecordValues(split.delivery) || hasRecordValues(split.credentials) || hasRecordValues(adapterConfig)
    );
    const providerRunId = resolveProviderRunId(input.providerState, provisioningConfig, input.idempotencyKey);
    const completedAt = new Date().toISOString();
    const completedProvisioning = {
      mode: 'provider', status: 'completed', boundary: 'provider_sdk_adapter',
      provisioningRunId: provisioningRun.id, replayOfRunId: context.replayOfRunId,
      provider: input.provider, operation: input.operation, region: input.region || undefined,
      executorKey: input.executorKey, adapterKey: input.adapterKey, idempotencyKey: input.idempotencyKey,
      credentialRef: input.credentialRef || undefined, providerRunId,
      providerStateStatus: input.providerStateStatus || undefined,
      providerState: hasRecordValues(input.providerStateSummary) ? input.providerStateSummary : undefined,
      deliveryKeys: Object.keys(split.delivery), credentialKeys: Object.keys(split.credentials),
      createInstance: shouldCreateInstance, recoveredFromProviderState: true, completedAt,
    };
    const completion = await this.statusWriter.completeProvisionedRequest(teamId, userId, request, {
      createInstance: shouldCreateInstance,
      instanceName: readString(input.providerState.instanceName) || readString(input.providerState.resourceName)
        || resolveRequestedResourceName(request.spec) || (request.title as string),
      config: { ...adapterConfig, provisioningMode: 'provider', adapter: 'provider',
        provider: input.provider, operation: input.operation, region: input.region || undefined,
        providerRunId, credentialRef: input.credentialRef || undefined },
      delivery: split.delivery, credentials: split.credentials, provisioning: completedProvisioning,
      auditMetadata: { createInstance: shouldCreateInstance, provisioningMode: 'provider',
        boundary: 'provider_sdk_adapter', provider: input.provider, operation: input.operation,
        region: input.region || undefined, idempotencyKey: input.idempotencyKey,
        credentialRef: input.credentialRef || undefined, providerRunId,
        providerStateStatus: input.providerStateStatus || undefined,
        provisioningRunId: provisioningRun.id, recoveredFromProviderState: true },
    });
    await this.runWriter.finishProvisioningRun(provisioningRun, completedProvisioning);
    return completion.request;
  }
}
