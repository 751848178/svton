import {
  asRecord,
  readBoolean,
  readString,
  readStringArray,
} from "./monitoring-alert-evaluation-value.utils";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import type {
  CloudSyncFailureSample,
  CloudSyncProviderDiagnostic,
  CloudSyncRunForEvaluation,
} from "./monitoring-alert-cloud-provider-sync.types";

export function createFailureSample(
  run: CloudSyncRunForEvaluation,
  diagnostic: CloudSyncProviderDiagnostic,
): CloudSyncFailureSample {
  return {
    runId: run.id,
    provider: diagnostic.provider,
    status: run.status,
    reason:
      diagnostic.fallbackReason ||
      diagnostic.errors[0] ||
      "provider live inventory failed",
    startedAt: run.startedAt,
    fallbackReason: diagnostic.fallbackReason,
    errors: diagnostic.errors,
  };
}

export function isCloudSyncRunInRuleScope(
  rule: AlertRuleRecord,
  metadata: Record<string, unknown>,
) {
  if (rule.projectId && metadata.projectId !== rule.projectId) return false;
  if (rule.environmentId && metadata.environmentId !== rule.environmentId) {
    return false;
  }
  return true;
}

export function readProviderDiagnostics(
  value: unknown,
): CloudSyncProviderDiagnostic[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): CloudSyncProviderDiagnostic | null => {
      const record = asRecord(item);
      const provider = readString(record.provider);
      if (!provider) return null;
      return {
        provider,
        syncMode: readString(record.syncMode),
        fallbackReason: readString(record.fallbackReason),
        live: readBoolean(record.live),
        errors: readStringArray(record.errors),
      };
    })
    .filter((item): item is CloudSyncProviderDiagnostic => Boolean(item));
}

export function providerMatches(
  ruleProvider: string | undefined,
  provider: string,
) {
  return !ruleProvider || ruleProvider === "all" || ruleProvider === provider;
}

export function isLiveProviderFailure(diagnostic: CloudSyncProviderDiagnostic) {
  if (diagnostic.errors.length > 0) return true;
  if (!diagnostic.fallbackReason) return false;
  return /(live inventory failed|timeout|timed out|rate|throttl|quota|denied|unauthorized|forbidden|provider.*failed|request.*failed|network|econn|etimedout)/i.test(
    diagnostic.fallbackReason,
  );
}

export function isConfigFallback(diagnostic: CloudSyncProviderDiagnostic) {
  return (
    diagnostic.syncMode === "cloud_inventory_stub_fallback" ||
    diagnostic.live === false ||
    Boolean(diagnostic.fallbackReason)
  );
}
