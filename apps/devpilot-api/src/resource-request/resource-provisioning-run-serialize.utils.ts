/**
 * Serializer for a `ResourceProvisioningRun` row into the API view object.
 *
 * Extracted verbatim from `ResourceRequestService.serializeProvisioningRun`
 * so the recovery and provider-state services can share one implementation.
 * Pure data shaping — no behavior change.
 */

import { JsonRecord } from './resource-request.types';
import { asRecord } from './resource-provisioning-value.utils';

export function serializeProvisioningRun(run: JsonRecord) {
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
