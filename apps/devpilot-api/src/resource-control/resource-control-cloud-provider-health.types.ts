import { Prisma } from '@prisma/client';

export type CloudProviderHealthRun = {
  id: string;
  provider: string;
  status: string;
  discovered: number;
  error: string | null;
  metadata: Prisma.JsonValue | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export type CloudProviderDiagnosticRecord = {
  provider: string;
  syncMode?: string;
  parsedCount?: number;
  skippedCount?: number;
  errors: string[];
  fallbackReason?: string;
  live?: boolean;
  sdk?: string;
  regions: string[];
  requestPolicy?: Record<string, unknown>;
};

export type CloudProviderHealthIssue = {
  runId: string;
  type: 'sync_failed' | 'provider_failure';
  status: string;
  message: string;
  startedAt: string;
};

export type CloudProviderHealthAccumulator = {
  provider: string;
  totalRuns: number;
  liveRuns: number;
  fallbackRuns: number;
  failedRuns: number;
  providerFailureCount: number;
  configFallbackCount: number;
  quotaSignals: number;
  rateLimitSignals: number;
  timeoutSignals: number;
  discovered: number;
  lastRunAt?: string;
  lastStatus?: string;
  lastError?: string;
  sdk?: string;
  regions: Set<string>;
  lastRequestPolicy?: Record<string, unknown>;
  recentIssues: CloudProviderHealthIssue[];
};
