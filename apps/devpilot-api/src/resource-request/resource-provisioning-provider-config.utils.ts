/**
 * Provider SDK provisioning *config* helpers.
 *
 * Pure functions extracted from `resource-provisioning-provider.utils.ts` so
 * each file stays under the 200-line ceiling. Reads provider max-attempts,
 * adapter key, provider state source, and the providerState polling config /
 * mock-state lookup, and builds the polling metadata persisted on a run. No
 * behavior change.
 */

import {
  JsonRecord,
  ProviderStatePollingConfig,
} from './resource-request.types';
import {
  asRecord,
  clampPositiveInteger,
  hasRecordValues,
  readBoolean,
  readPositiveInteger,
  readString,
} from './resource-provisioning-value.utils';

export function readProviderMaxAttempts(config: JsonRecord) {
  const attempts = readPositiveInteger(config.maxAttempts)
    || readPositiveInteger(asRecord(config.retry).maxAttempts)
    || 1;
  return Math.min(Math.max(attempts, 1), 5);
}

export function resolveProviderAdapterKey(provider: string, config: JsonRecord) {
  const explicit = readString(config.adapterKey);
  if (explicit) {
    return explicit;
  }
  return provider ? `${provider}-sdk` : 'cloud-provider-sdk';
}

export function readProviderProvisioningState(config: JsonRecord) {
  const state = asRecord(config.providerState);
  if (hasRecordValues(state)) {
    return state;
  }

  const existingState = asRecord(config.existingProviderState);
  if (hasRecordValues(existingState)) {
    return existingState;
  }

  return asRecord(config.idempotencyState);
}

export function readProviderStatePollingConfig(config: JsonRecord): ProviderStatePollingConfig {
  const polling = asRecord(config.providerStatePolling);
  const query = asRecord(config.providerStateQuery);
  const enabled = readBoolean(
    polling.enabled,
    readBoolean(query.pollingEnabled, readBoolean(config.providerStatePolling, false)),
  );
  const intervalSeconds = clampPositiveInteger(
    readPositiveInteger(polling.intervalSeconds)
      || readPositiveInteger(query.intervalSeconds)
      || readPositiveInteger(config.providerStatePollingIntervalSeconds)
      || 60,
    10,
    86400,
  );
  const maxAttempts = clampPositiveInteger(
    readPositiveInteger(polling.maxAttempts)
      || readPositiveInteger(query.maxAttempts)
      || readPositiveInteger(config.providerStatePollingMaxAttempts)
      || 10,
    1,
    100,
  );
  const createInstanceValue = polling.createInstance ?? query.createInstance;
  const source = hasRecordValues(polling) || typeof config.providerStatePolling === 'boolean'
    ? 'providerStatePolling'
    : 'providerStateQuery';

  return {
    enabled,
    intervalSeconds,
    maxAttempts,
    source,
    createInstance: typeof createInstanceValue === 'undefined'
      ? undefined
      : readBoolean(createInstanceValue, true),
    instanceName: readString(polling.instanceName) || readString(query.instanceName) || undefined,
  };
}

export function readProviderStatePollingState(config: JsonRecord, attempt: number) {
  const sources = [
    { source: 'providerStatePolling', config: asRecord(config.providerStatePolling) },
    { source: 'providerStateQuery', config: asRecord(config.providerStateQuery) },
  ];

  for (const entry of sources) {
    const providerState = readProviderStatePollingStateFromSource(entry.config, attempt);
    if (hasRecordValues(providerState)) {
      return { providerState, source: entry.source };
    }
  }

  return { providerState: {}, source: 'none' };
}

export function readProviderStatePollingStateFromSource(source: JsonRecord, attempt: number) {
  const mockStates = Array.isArray(source.mockStates)
    ? source.mockStates.map((entry) => asRecord(entry)).filter((entry) => hasRecordValues(entry))
    : [];
  if (mockStates.length > 0) {
    return mockStates[Math.min(Math.max(attempt, 1) - 1, mockStates.length - 1)];
  }

  const mockState = asRecord(source.mockState);
  if (hasRecordValues(mockState)) {
    return mockState;
  }

  const providerState = asRecord(source.providerState);
  if (hasRecordValues(providerState)) {
    return providerState;
  }

  return asRecord(source.state);
}

export function buildProviderStatePollingMetadata(
  config: ProviderStatePollingConfig,
  attempt: number,
  now: Date,
  nextAvailableAt: Date | null,
  input: {
    source?: string;
    stateFound?: boolean;
    providerStateStatus?: string;
    reason?: string;
  } = {},
) {
  return {
    enabled: config.enabled,
    source: input.source || config.source,
    attempt,
    maxAttempts: config.maxAttempts,
    intervalSeconds: config.intervalSeconds,
    stateFound: input.stateFound,
    providerStateStatus: input.providerStateStatus,
    reason: input.reason,
    lastPolledAt: now.toISOString(),
    nextPollAt: nextAvailableAt ? nextAvailableAt.toISOString() : undefined,
  };
}
