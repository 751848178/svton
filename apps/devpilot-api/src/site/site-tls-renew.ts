import { Prisma } from '@prisma/client';
import {
  classifyCertbotRenewOutput,
  collectText,
  fallbackSummary,
  isRecord,
  type SiteTlsRenewalStatus,
} from './site-certbot-classifier.utils';

type JsonRecord = Record<string, unknown>;

export type { SiteTlsRenewalStatus };

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

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
