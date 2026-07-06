/**
 * Provider SDK provisioning *state* helpers.
 *
 * Pure functions extracted from `resource-provisioning-provider.utils.ts` so
 * each file stays under the 200-line ceiling. Classifies a providerState into
 * completed / failed / pending, derives the provider run id and delivery
 * source, resolves a redacted credential ref from a run row, and builds the
 * provider SDK plan VO. No behavior change.
 */

import {
  JsonRecord,
  ProvisioningResourceType,
} from './resource-request.types';
import {
  asRecord,
  hasRecordValues,
  readBoolean,
  readString,
} from './resource-provisioning-value.utils';
import { resolveRequestedResourceName } from './resource-provisioning-sensitive.utils';

export function readProviderStateStatus(state: JsonRecord) {
  return (
    readString(state.status)
    || readString(state.state)
    || readString(state.phase)
    || readString(state.lifecycleStatus)
  ).toLowerCase();
}

export function providerStateIndicatesCompleted(state: JsonRecord) {
  const completedStatuses = new Set([
    'active',
    'available',
    'completed',
    'created',
    'ready',
    'running',
    'success',
    'succeeded',
  ]);
  const status = readProviderStateStatus(state);
  return completedStatuses.has(status) || readBoolean(state.exists, false);
}

export function providerStateIndicatesFailed(state: JsonRecord) {
  const failedStatuses = new Set([
    'cancelled',
    'deleted',
    'error',
    'failed',
    'not_found',
    'rejected',
    'terminated',
  ]);
  const status = readProviderStateStatus(state);
  return failedStatuses.has(status) || readBoolean(state.failed, false);
}

export function readProviderStateReason(state: JsonRecord) {
  return (
    readString(state.reason)
    || readString(state.error)
    || readString(state.message)
    || 'provider_state_failed'
  );
}

export function resolveRunCredentialRef(run: JsonRecord, provisioning: JsonRecord) {
  const provisioningCredentialRef = asRecord(provisioning.credentialRef);
  if (hasRecordValues(provisioningCredentialRef)) {
    return provisioningCredentialRef;
  }

  const credentialId = readString(run.credentialId);
  const authAdapterKey = readString(run.authAdapterKey);
  if (!credentialId && !authAdapterKey) {
    return null;
  }

  return {
    source: 'team_credential',
    referenceId: credentialId || undefined,
    authAdapterKey: authAdapterKey || 'provider-credential-ref',
    redacted: true,
  };
}

export function resolveProviderRunId(state: JsonRecord, config: JsonRecord, idempotencyKey: string) {
  return (
    readString(state.providerRunId)
    || readString(state.runId)
    || readString(state.requestId)
    || readString(config.providerRunId)
    || readString(config.externalId)
    || idempotencyKey
  );
}

export function resolveProviderProvisioningDeliverySource(state: JsonRecord, config: JsonRecord) {
  const delivery = asRecord(state.delivery);
  const credentials = asRecord(state.credentials);

  if (hasRecordValues(delivery) || hasRecordValues(credentials)) {
    return {
      ...delivery,
      ...credentials,
    };
  }

  const resource = asRecord(state.resource);
  if (hasRecordValues(resource)) {
    return resource;
  }

  const instance = asRecord(state.instance);
  if (hasRecordValues(instance)) {
    return instance;
  }

  return asRecord(config.delivery);
}

export function buildProviderProvisioningPlan(input: {
  request: JsonRecord;
  resourceType: ProvisioningResourceType;
  provider: string;
  operation: string;
  region: string;
  idempotencyKey: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  providerState: JsonRecord;
}) {
  const stateProviderRunId = readString(input.providerState.providerRunId)
    || readString(input.providerState.runId)
    || undefined;
  const externalId = readString(input.providerState.externalId)
    || readString(asRecord(input.providerState.resource).externalId)
    || undefined;
  const spec = asRecord(input.request.spec);

  return {
    boundary: 'provider_sdk_adapter',
    executorKey: input.executorKey,
    adapterKey: input.adapterKey,
    provider: input.provider || undefined,
    operation: input.operation,
    region: input.region || undefined,
    dryRun: input.dryRun,
    idempotencyKey: input.idempotencyKey,
    resourceType: {
      id: input.resourceType.id,
      key: input.resourceType.key,
      name: input.resourceType.name,
    },
    request: {
      id: input.request.id,
      projectId: input.request.projectId,
      environmentId: input.request.environmentId,
      environment: input.request.environment,
      requestedResourceName: resolveRequestedResourceName(input.request.spec),
      specKeys: Object.keys(spec),
    },
    providerStateQuery: {
      strategy: 'idempotency_key_or_external_id',
      idempotencyKey: input.idempotencyKey,
      providerRunId: stateProviderRunId,
      externalId,
      expectedStatus: 'active_or_available',
    },
    safety: {
      secretsInOutput: 'must_mask_before_persisting',
      liveTransport: input.dryRun ? 'disabled_dry_run_plan' : 'not_implemented',
    },
  };
}
