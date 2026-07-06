/**
 * Builder for the `resourceProvisioningRun.create()` data + params payload.
 *
 * Extracted from `ResourceProvisioningRunWriterService.createProvisioningRun`
 * so the writer service stays under the 200-line ceiling. Pure function —
 * identical params/data shape as the original inline construction. No behavior
 * change.
 */

import {
  ExternalProvisioningRunMode,
  JsonRecord,
  ProvisioningProcessorContext,
  ProvisioningQueueConfig,
  ResourceProvisioningRunRecord,
} from './resource-request.types';
import {
  asRecord,
  readBoolean,
  readNonNegativeInteger,
  readPositiveInteger,
  readString,
} from './resource-provisioning-value.utils';

export function buildProvisioningRunCreateData(input: {
  teamId: string;
  userId: string | undefined;
  request: JsonRecord;
  resourceType: { id: string; key: string };
  mode: ExternalProvisioningRunMode;
  context: ProvisioningProcessorContext;
  config: JsonRecord;
  createInput: {
    method?: string;
    url?: string;
    idempotencyKey: string;
    maxAttempts: number;
    queue: ProvisioningQueueConfig;
    boundary?: string;
    executorKey?: string;
    adapterKey?: string;
    params?: JsonRecord;
  };
  queuedAt: Date | undefined;
  availableAt: Date | undefined;
}): JsonRecord {
  const { teamId, userId, request, resourceType, mode, context, config, createInput, queuedAt, availableAt } = input;
  const now = new Date();
  const params: JsonRecord = {
    idempotencyKey: createInput.idempotencyKey,
    requestId: request.id,
    resourceTypeId: resourceType.id,
    resourceTypeKey: resourceType.key,
    trigger: context.trigger,
    queueMode: createInput.queue.enabled ? 'queued' : 'inline',
    ...asRecord(createInput.params),
  };
  if (createInput.method) {
    params.method = createInput.method;
  }
  if (context.replayOfRunId) {
    params.replayOfRunId = context.replayOfRunId;
  }
  if (createInput.url) {
    params.url = createInput.url;
  }
  if (createInput.queue.enabled) {
    params.queuedAt = queuedAt?.toISOString();
    params.availableAt = availableAt?.toISOString();
    params.queueDelaySeconds = createInput.queue.delaySeconds;
  }
  if (request.projectId) {
    params.projectId = request.projectId;
  }
  if (request.environmentId) {
    params.environmentId = request.environmentId;
  }

  return {
    teamId,
    actorId: userId,
    replayOfRunId: context.replayOfRunId,
    requestId: request.id,
    resourceTypeId: resourceType.id,
    projectId: readString(request.projectId) || undefined,
    environmentId: readString(request.environmentId) || undefined,
    mode,
    trigger: context.trigger,
    boundary: createInput.boundary || 'http_adapter',
    executorKey: readString(config.executorKey) || createInput.executorKey || 'resource-request',
    adapterKey: readString(config.adapterKey) || createInput.adapterKey || mode,
    idempotencyKey: createInput.idempotencyKey,
    status: createInput.queue.enabled ? 'queued' : 'running',
    queueMode: createInput.queue.enabled ? 'queued' : 'inline',
    attempt: 0,
    maxAttempts: createInput.maxAttempts,
    autoRetry: context.trigger === 'auto_retry',
    params,
    queuedAt,
    availableAt,
  };
}

export function buildFinishProvisioningRunData(
  run: ResourceProvisioningRunRecord,
  provisioning: JsonRecord,
): JsonRecord {
  const status = readString(provisioning.status) || 'blocked';
  const providerRunId = readString(provisioning.providerRunId);
  const reason = readString(provisioning.reason) || readString(provisioning.error);
  const attempt = readNonNegativeInteger(provisioning.attempt) ?? readNonNegativeInteger(run.attempt) ?? 0;
  const maxAttempts = readPositiveInteger(provisioning.maxAttempts)
    || readPositiveInteger(run.maxAttempts)
    || 1;
  const autoRetry = asRecord(provisioning.autoRetry);
  const data: JsonRecord = {
    status,
    attempt,
    maxAttempts,
    retryable: readBoolean(provisioning.retryable, false),
    autoRetry: readBoolean(autoRetry.enabled, readBoolean(run.autoRetry, false)),
    result: {
      provisioning,
    },
    lockedAt: null,
    lockOwner: null,
    finishedAt: new Date(),
  };

  if (providerRunId) {
    data.providerRunId = providerRunId;
  }
  if (reason && status !== 'completed') {
    data.error = reason;
  }

  return data;
}

