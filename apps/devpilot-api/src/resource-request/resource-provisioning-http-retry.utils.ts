/**
 * HTTP / external-adapter provisioning *retry / queue* helpers.
 *
 * Pure functions split out of `resource-provisioning-http-config.utils.ts` so
 * each file stays under the 200-line ceiling. Classifies retryable HTTP status
 * codes, reads the per-adapter HTTP max-attempts, computes the auto-retry
 * metadata written back on a blocked HTTP run, decides whether a blocked run
 * is due for an auto-retry scan, and parses the per-adapter queue config.
 * No behavior change.
 */

import {
  JsonRecord,
  ProvisioningAutoRetryConfig,
  ProvisioningProcessorContext,
} from './resource-request.types';
import {
  asRecord,
  clampNonNegativeInteger,
  clampPositiveInteger,
  readBoolean,
  readNonNegativeInteger,
  readPositiveInteger,
  readString,
} from './resource-provisioning-value.utils';
import { normalizeProvisioningMode } from './resource-provisioning-script.utils';

export function readHttpMaxAttempts(config: JsonRecord) {
  const attempts = readPositiveInteger(config.maxAttempts)
    || readPositiveInteger(asRecord(config.retry).maxAttempts)
    || 1;
  return Math.min(Math.max(attempts, 1), 5);
}

export function readHttpRetryStatusCodes(config: JsonRecord) {
  const retry = asRecord(config.retry);
  const input = Array.isArray(config.retryStatusCodes)
    ? config.retryStatusCodes
    : Array.isArray(retry.statusCodes)
      ? retry.statusCodes
      : [408, 425, 429, 500, 502, 503, 504];

  return input.reduce<Set<number>>((acc, value) => {
    const code = typeof value === 'number' ? value : Number.parseInt(readString(value), 10);
    if (Number.isInteger(code) && code >= 100 && code <= 599) {
      acc.add(code);
    }
    return acc;
  }, new Set<number>());
}

export function isRetryableHttpStatus(status: number, retryStatusCodes: Set<number>) {
  return retryStatusCodes.has(status);
}

export function isProvisioningAutoRetryDue(request: JsonRecord, now: Date) {
  const provisioning = asRecord(asRecord(request.result).provisioning);
  if (readString(provisioning.status) !== 'blocked') {
    return false;
  }

  const resourceType = asRecord(request.resourceType);
  const mode = normalizeProvisioningMode(
    readString(provisioning.mode) || readString(resourceType.provisioningMode),
  );
  if (mode !== 'api' && mode !== 'webhook') {
    return false;
  }

  const autoRetry = asRecord(provisioning.autoRetry);
  if (!readBoolean(autoRetry.enabled, false)) {
    return false;
  }
  if (!readBoolean(provisioning.retryable, readBoolean(autoRetry.retryable, false))) {
    return false;
  }
  if (readBoolean(autoRetry.exhausted, false)) {
    return false;
  }

  const maxScheduledAttempts = readPositiveInteger(autoRetry.maxScheduledAttempts) || 0;
  const scheduledAttempts = readNonNegativeInteger(autoRetry.scheduledAttempts) || 0;
  if (maxScheduledAttempts > 0 && scheduledAttempts >= maxScheduledAttempts) {
    return false;
  }

  const nextAttemptAt = readString(autoRetry.nextAttemptAt);
  if (!nextAttemptAt) {
    return false;
  }

  const dueAt = Date.parse(nextAttemptAt);
  return Number.isFinite(dueAt) && dueAt <= now.getTime();
}

export function readProvisioningAutoRetryConfig(config: JsonRecord): ProvisioningAutoRetryConfig {
  const retry = asRecord(config.retry);
  const autoRetry = asRecord(config.autoRetry);
  const retryAutoRetry = asRecord(retry.autoRetry);
  const enabled = readBoolean(autoRetry.enabled, readBoolean(retryAutoRetry.enabled, false));
  const delaySeconds = clampPositiveInteger(
    readPositiveInteger(autoRetry.delaySeconds)
      || readPositiveInteger(retryAutoRetry.delaySeconds)
      || readPositiveInteger(config.autoRetryDelaySeconds)
      || 60,
    10,
    86400,
  );
  const maxScheduledAttempts = clampPositiveInteger(
    readPositiveInteger(autoRetry.maxScheduledAttempts)
      || readPositiveInteger(retryAutoRetry.maxScheduledAttempts)
      || readPositiveInteger(config.maxScheduledAutoRetries)
      || 3,
    1,
    20,
  );

  return {
    enabled,
    delaySeconds,
    maxScheduledAttempts,
  };
}

export function buildHttpAutoRetryMetadata(
  provisioningConfig: JsonRecord,
  request: JsonRecord,
  retryable: boolean,
  context: ProvisioningProcessorContext,
  now: Date,
): JsonRecord {
  const config = readProvisioningAutoRetryConfig(provisioningConfig);
  if (!config.enabled) {
    return {};
  }

  const previousProvisioning = asRecord(asRecord(request.result).provisioning);
  const previousAutoRetry = asRecord(previousProvisioning.autoRetry);
  const previousScheduledAttempts = readNonNegativeInteger(previousAutoRetry.scheduledAttempts) || 0;
  const scheduledAttempts = previousScheduledAttempts + (context.trigger === 'auto_retry' ? 1 : 0);
  const exhausted = !retryable || scheduledAttempts >= config.maxScheduledAttempts;
  const nextAttemptAt = retryable && !exhausted
    ? new Date(now.getTime() + config.delaySeconds * 1000).toISOString()
    : undefined;
  const lastTriggeredAt = context.trigger === 'auto_retry'
    ? now.toISOString()
    : readString(previousAutoRetry.lastTriggeredAt) || undefined;
  const autoRetryState: JsonRecord = {
    enabled: true,
    retryable,
    scheduledAttempts,
    maxScheduledAttempts: config.maxScheduledAttempts,
    delaySeconds: config.delaySeconds,
    exhausted,
  };
  if (nextAttemptAt) {
    autoRetryState.nextAttemptAt = nextAttemptAt;
  }
  if (lastTriggeredAt) {
    autoRetryState.lastTriggeredAt = lastTriggeredAt;
  }

  return {
    autoRetry: autoRetryState,
  };
}

export function readProvisioningQueueConfig(
  config: JsonRecord,
  httpQueueFeatureEnabled: boolean,
) {
  const queue = asRecord(config.queue);
  const enabled = readBoolean(
    queue.enabled,
    readBoolean(config.queue, httpQueueFeatureEnabled),
  );
  const delaySeconds = clampNonNegativeInteger(
    readNonNegativeInteger(queue.delaySeconds)
      ?? readNonNegativeInteger(config.queueDelaySeconds)
      ?? readNonNegativeInteger(config.queueAvailableDelaySeconds)
      ?? 0,
    0,
    86400,
  );

  return {
    enabled,
    delaySeconds,
  };
}
