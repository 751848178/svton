import {
  CloudProviderDiagnosticRecord,
  CloudProviderHealthAccumulator,
  CloudProviderHealthRun,
} from './resource-control-cloud-provider-health.types';
import { asNumber, asOptionalRecord, asRecord, asString, asStringArray } from './resource-control-value.utils';

export function summarizeCloudProviderHealthRuns(runs: CloudProviderHealthRun[]) {
  const providers = new Map<string, CloudProviderHealthAccumulator>();

  runs.forEach((run) => {
    const metadata = asRecord(run.metadata);
    const diagnostics = readCloudProviderDiagnostics(metadata.providers);
    const scopedDiagnostics =
      diagnostics.length > 0 ? diagnostics : [{ provider: run.provider, errors: [], regions: [] }];

    scopedDiagnostics.forEach((diagnostic) => {
      const summary = ensureCloudProviderHealthSummary(providers, diagnostic.provider);
      summary.totalRuns += 1;
      summary.discovered += run.discovered;
      summary.lastRunAt = latestDateString(summary.lastRunAt, run.startedAt);
      if (
        !summary.lastStatus ||
        !summary.lastRunAt ||
        new Date(run.startedAt).getTime() >= new Date(summary.lastRunAt).getTime()
      ) {
        summary.lastStatus = run.status;
        summary.lastError = run.error || diagnostic.fallbackReason || diagnostic.errors[0];
        summary.lastRequestPolicy = diagnostic.requestPolicy;
        summary.sdk = diagnostic.sdk || summary.sdk;
      }

      addCloudProviderRunSignals(summary, run, diagnostic);
    });
  });

  return Array.from(providers.values())
    .map(toCloudProviderHealthSummaryResponse)
    .sort((left, right) => left.provider.localeCompare(right.provider));
}

function addCloudProviderRunSignals(
  summary: CloudProviderHealthAccumulator,
  run: CloudProviderHealthRun,
  diagnostic: CloudProviderDiagnosticRecord,
) {
  if (run.status === 'failed') {
    summary.failedRuns += 1;
    summary.recentIssues.push({
      runId: run.id,
      type: 'sync_failed',
      status: run.status,
      message: run.error || 'cloud sync failed',
      startedAt: run.startedAt.toISOString(),
    });
  }

  if (diagnostic.live) {
    summary.liveRuns += 1;
  } else if (diagnostic.syncMode === 'cloud_inventory_stub_fallback' || diagnostic.fallbackReason) {
    summary.fallbackRuns += 1;
  }

  diagnostic.regions.forEach((region) => summary.regions.add(region));
  const issueText = [run.error, diagnostic.fallbackReason, ...diagnostic.errors].filter((item): item is string =>
    Boolean(item),
  );

  if (isProviderFailure(diagnostic, run.status)) {
    summary.providerFailureCount += 1;
    summary.recentIssues.push({
      runId: run.id,
      type: 'provider_failure',
      status: run.status,
      message: diagnostic.fallbackReason || diagnostic.errors[0] || run.error || 'provider failure',
      startedAt: run.startedAt.toISOString(),
    });
  } else if (isConfigFallback(diagnostic)) {
    summary.configFallbackCount += 1;
  }

  issueText.forEach((message) => {
    if (/quota/i.test(message)) summary.quotaSignals += 1;
    if (/(rate|throttl)/i.test(message)) summary.rateLimitSignals += 1;
    if (/(timeout|timed out|etimedout)/i.test(message)) summary.timeoutSignals += 1;
  });
}

function toCloudProviderHealthSummaryResponse(summary: CloudProviderHealthAccumulator) {
  const status =
    summary.providerFailureCount > 0 || summary.failedRuns > 0
      ? 'error'
      : summary.configFallbackCount > 0 ||
          summary.quotaSignals > 0 ||
          summary.rateLimitSignals > 0 ||
          summary.timeoutSignals > 0
        ? 'degraded'
        : summary.totalRuns > 0
          ? 'healthy'
          : 'unknown';
  return {
    provider: summary.provider,
    status,
    totalRuns: summary.totalRuns,
    liveRuns: summary.liveRuns,
    fallbackRuns: summary.fallbackRuns,
    failedRuns: summary.failedRuns,
    providerFailureCount: summary.providerFailureCount,
    configFallbackCount: summary.configFallbackCount,
    quotaSignals: summary.quotaSignals,
    rateLimitSignals: summary.rateLimitSignals,
    timeoutSignals: summary.timeoutSignals,
    discovered: summary.discovered,
    lastRunAt: summary.lastRunAt,
    lastStatus: summary.lastStatus,
    lastError: summary.lastError,
    sdk: summary.sdk,
    regions: Array.from(summary.regions).sort(),
    lastRequestPolicy: summary.lastRequestPolicy,
    recentIssues: summary.recentIssues.slice(0, 5),
  };
}

function ensureCloudProviderHealthSummary(providers: Map<string, CloudProviderHealthAccumulator>, provider: string) {
  const existing = providers.get(provider);
  if (existing) return existing;
  const created = emptyCloudProviderHealthSummary(provider);
  providers.set(provider, created);
  return created;
}

function emptyCloudProviderHealthSummary(provider: string): CloudProviderHealthAccumulator {
  return {
    provider,
    totalRuns: 0,
    liveRuns: 0,
    fallbackRuns: 0,
    failedRuns: 0,
    providerFailureCount: 0,
    configFallbackCount: 0,
    quotaSignals: 0,
    rateLimitSignals: 0,
    timeoutSignals: 0,
    discovered: 0,
    regions: new Set<string>(),
    recentIssues: [],
  };
}

function readCloudProviderDiagnostics(value: unknown): CloudProviderDiagnosticRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): CloudProviderDiagnosticRecord | null => {
      const record = asRecord(item);
      const provider = asString(record.provider);
      if (!provider) return null;
      return {
        provider,
        syncMode: asString(record.syncMode),
        parsedCount: asNumber(record.parsedCount),
        skippedCount: asNumber(record.skippedCount),
        errors: asStringArray(record.errors),
        fallbackReason: asString(record.fallbackReason),
        live: typeof record.live === 'boolean' ? record.live : undefined,
        sdk: asString(record.sdk),
        regions: asStringArray(record.regions),
        requestPolicy: asOptionalRecord(record.requestPolicy),
      };
    })
    .filter((item): item is CloudProviderDiagnosticRecord => Boolean(item));
}

function latestDateString(current: string | undefined, next: Date) {
  if (!current || next.getTime() > new Date(current).getTime()) {
    return next.toISOString();
  }
  return current;
}

function isProviderFailure(diagnostic: CloudProviderDiagnosticRecord, runStatus: string) {
  if (runStatus === 'failed') return true;
  if (diagnostic.errors.length > 0) return true;
  if (!diagnostic.fallbackReason) return false;
  return /(live inventory failed|timeout|timed out|rate|throttl|quota|denied|unauthorized|forbidden|provider.*failed|request.*failed|network|econn|etimedout)/i.test(
    diagnostic.fallbackReason,
  );
}

function isConfigFallback(diagnostic: CloudProviderDiagnosticRecord) {
  return (
    diagnostic.syncMode === 'cloud_inventory_stub_fallback' ||
    diagnostic.live === false ||
    Boolean(diagnostic.fallbackReason)
  );
}
