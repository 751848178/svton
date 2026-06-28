import { Prisma } from '@prisma/client';

type JsonRecord = Record<string, unknown>;

export type SiteTlsRenewalStatus = 'succeeded' | 'not_due' | 'failed' | 'unknown';

export type SiteTlsRenewMetadata = {
  source: 'certbot_renew';
  status: SiteTlsRenewalStatus;
  dryRun: boolean;
  checkedAt: string;
  runId?: string;
  attempted: boolean;
  succeeded: boolean;
  summary: string;
  renewedAt?: string;
  failureReason?: string;
};

export type SiteTlsRenewFollowUpProbeMetadata = {
  status: 'queued' | 'failed';
  sourceRenewalRunId?: string;
  siteSyncRunId?: string;
  serverExecutionJobId?: string;
  queuedAt?: string;
  failedAt?: string;
  error?: string;
};

export function extractSiteTlsRenewMetadata(input: {
  result?: unknown;
  logs?: unknown;
  executionStatus?: string;
  dryRun: boolean;
  runId?: string;
  now?: Date;
}): SiteTlsRenewMetadata {
  const textChunks: string[] = [];
  collectText(input.result, textChunks);
  collectText(input.logs, textChunks);

  const text = textChunks.join('\n');
  const parsed = classifyCertbotRenewOutput(text, input.executionStatus);
  const checkedAt = (input.now || new Date()).toISOString();
  const succeeded = parsed.status === 'succeeded';
  const metadata: SiteTlsRenewMetadata = {
    source: 'certbot_renew',
    status: parsed.status,
    dryRun: input.dryRun,
    checkedAt,
    runId: input.runId,
    attempted: parsed.attempted,
    succeeded,
    summary: parsed.summary || fallbackSummary(parsed.status, input.dryRun),
  };

  if (succeeded && !input.dryRun) {
    metadata.renewedAt = checkedAt;
  }
  if (parsed.status === 'failed') {
    metadata.failureReason = metadata.summary;
  }

  return metadata;
}

export function mergeSiteTlsRenewMetadata(
  currentTls: unknown,
  metadata: SiteTlsRenewMetadata,
): Prisma.InputJsonValue {
  const current = isRecord(currentTls) ? currentTls : {};
  const currentRenewal = isRecord(current.renewal) ? current.renewal : {};
  const next: JsonRecord = {
    ...current,
    renewal: {
      ...currentRenewal,
      source: metadata.source,
      status: metadata.status,
      dryRun: metadata.dryRun,
      checkedAt: metadata.checkedAt,
      runId: metadata.runId,
      attempted: metadata.attempted,
      succeeded: metadata.succeeded,
      summary: metadata.summary,
      renewedAt: metadata.renewedAt,
      failureReason: metadata.failureReason,
    },
    lastRenewalStatus: metadata.status,
    lastRenewalCheckedAt: metadata.checkedAt,
    lastRenewalSummary: metadata.summary,
    lastRenewalRunId: metadata.runId,
  };

  if (metadata.dryRun) {
    next.lastRenewalDryRunAt = metadata.checkedAt;
  }
  if (!metadata.dryRun && metadata.succeeded) {
    next.lastRenewedAt = metadata.renewedAt || metadata.checkedAt;
  }
  if (!metadata.dryRun && metadata.status === 'failed') {
    next.lastRenewalFailedAt = metadata.checkedAt;
  }

  return toJsonValue(next);
}

export function mergeSiteTlsRenewFollowUpProbeMetadata(
  currentTls: unknown,
  metadata: SiteTlsRenewFollowUpProbeMetadata,
): Prisma.InputJsonValue {
  const current = isRecord(currentTls) ? currentTls : {};
  const currentRenewal = isRecord(current.renewal) ? current.renewal : {};
  const currentFollowUp = isRecord(currentRenewal.followUpProbe) ? currentRenewal.followUpProbe : {};

  return toJsonValue({
    ...current,
    renewal: {
      ...currentRenewal,
      followUpProbe: {
        ...currentFollowUp,
        ...metadata,
      },
    },
    lastRenewalFollowUpProbeStatus: metadata.status,
    lastRenewalFollowUpProbeRunId: metadata.siteSyncRunId,
    lastRenewalFollowUpProbeJobId: metadata.serverExecutionJobId,
    lastRenewalFollowUpProbeQueuedAt: metadata.queuedAt,
    lastRenewalFollowUpProbeFailedAt: metadata.failedAt,
  });
}

function classifyCertbotRenewOutput(
  text: string,
  executionStatus?: string,
): { status: SiteTlsRenewalStatus; attempted: boolean; summary?: string } {
  const lower = text.toLowerCase();

  if (executionStatus === 'failed') {
    return {
      status: 'failed',
      attempted: true,
      summary: selectSummaryLine(text, ['failed', 'error', 'unable', 'could not']),
    };
  }

  if (
    /congratulations/.test(lower)
    || /successfully renewed/.test(lower)
    || /renewal succeeded/.test(lower)
    || /all renewals succeeded/.test(lower)
    || /all simulated renewals succeeded/.test(lower)
  ) {
    return {
      status: 'succeeded',
      attempted: true,
      summary: selectSummaryLine(text, [
        'congratulations',
        'successfully renewed',
        'renewal succeeded',
        'all renewals succeeded',
        'all simulated renewals succeeded',
      ]),
    };
  }

  if (
    /no renewals were attempted/.test(lower)
    || /not due for renewal/.test(lower)
    || /not yet due/.test(lower)
    || /skipping/.test(lower)
  ) {
    return {
      status: 'not_due',
      attempted: false,
      summary: selectSummaryLine(text, [
        'no renewals were attempted',
        'not due for renewal',
        'not yet due',
        'skipping',
      ]),
    };
  }

  if (/failed/.test(lower) || /error/.test(lower) || /unable to renew/.test(lower) || /could not/.test(lower)) {
    return {
      status: 'failed',
      attempted: true,
      summary: selectSummaryLine(text, ['failed', 'error', 'unable to renew', 'could not']),
    };
  }

  return {
    status: executionStatus === 'completed' ? 'unknown' : 'failed',
    attempted: executionStatus !== 'completed',
    summary: selectSummaryLine(text, []),
  };
}

function selectSummaryLine(text: string, keywords: string[]) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const matched = lowerKeywords.length > 0
    ? lines.find((line) => lowerKeywords.some((keyword) => line.toLowerCase().includes(keyword)))
    : lines[0];
  return truncateSummary(matched);
}

function fallbackSummary(status: SiteTlsRenewalStatus, dryRun: boolean) {
  if (status === 'succeeded') return dryRun ? 'Certbot renewal dry-run succeeded' : 'Certbot renewal succeeded';
  if (status === 'not_due') return 'Certificate is not due for renewal';
  if (status === 'failed') return dryRun ? 'Certbot renewal dry-run failed' : 'Certbot renewal failed';
  return 'Certbot renewal completed with unknown result';
}

function truncateSummary(value?: string) {
  if (!value) return undefined;
  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}

function collectText(value: unknown, target: string[]) {
  if (typeof value === 'string') {
    target.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, target));
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  for (const key of ['stdoutPreview', 'stdout', 'message', 'output', 'stderrPreview', 'stderr']) {
    const item = value[key];
    if (typeof item === 'string') {
      target.push(item);
    }
  }

  for (const key of ['logs', 'result', 'results', 'commandResults', 'steps']) {
    collectText(value[key], target);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
