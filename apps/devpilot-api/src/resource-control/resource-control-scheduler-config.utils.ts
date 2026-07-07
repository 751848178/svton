/**
 * Pure config readers + summary builders for the resource-control scheduler.
 *
 * The scheduler reads ~10 feature-flag/size/interval values from ConfigService.
 * Moving the parsing here keeps the scheduler service under the file-size
 * ceiling and makes the numeric clamping unit-testable without Nest wiring.
 * Each reader takes the raw config string (already fetched via
 * `configService.get`) so these functions stay pure.
 */

export type ScheduledSyncSummary = {
  skipped: boolean;
  staleMarked: number;
  dockerSync: {
    enabled: boolean;
    attempted: number;
    completed: number;
    failed: number;
  };
  dockerMetrics: {
    enabled: boolean;
    attempted: number;
    submitted: number;
    skippedRecent: number;
    failed: number;
  };
};

export function schedulerEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}

export function intervalSeconds(raw: string | undefined): number {
  const seconds = Number(raw ?? '300');
  return Number.isFinite(seconds) && seconds >= 30 ? seconds : 300;
}

export function scheduledDockerSyncEnabled(raw: string | undefined): boolean {
  return (raw ?? 'true') === 'true';
}

export function scheduledDockerMetricsEnabled(raw: string | undefined): boolean {
  return (raw ?? 'false') === 'true';
}

export function staleAfterMs(raw: string | undefined): number {
  const seconds = Number(raw ?? '86400');
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return seconds * 1000;
}

export function serverBatchSize(raw: string | undefined): number {
  const size = Number(raw ?? '10');
  return Number.isInteger(size) && size > 0 ? Math.min(size, 50) : 10;
}

export function metricResourceBatchSize(raw: string | undefined): number {
  const size = Number(raw ?? '20');
  return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
}

export function metricsMaxAttempts(raw: string | undefined): number {
  const attempts = Number(raw ?? '1');
  return Number.isInteger(attempts) && attempts > 0 ? Math.min(attempts, 5) : 1;
}

export function metricsMinIntervalMs(raw: string | undefined): number {
  const seconds = Number(raw ?? '300');
  const safeSeconds = Number.isFinite(seconds) && seconds >= 30 ? seconds : 300;
  return safeSeconds * 1000;
}

/** Build an empty/placeholder summary (used when the tick is skipped or a phase is disabled). */
export function emptyScheduledSyncSummary(
  skipped: boolean,
  dockerSyncEnabled: boolean,
  dockerMetricsEnabled: boolean,
): ScheduledSyncSummary {
  return {
    skipped,
    staleMarked: 0,
    dockerSync: { enabled: dockerSyncEnabled, attempted: 0, completed: 0, failed: 0 },
    dockerMetrics: {
      enabled: dockerMetricsEnabled,
      attempted: 0,
      submitted: 0,
      skippedRecent: 0,
      failed: 0,
    },
  };
}

/** Build a disabled-phase summary for the Docker sync phase. */
export function disabledDockerSyncSummary() {
  return { enabled: false, attempted: 0, completed: 0, failed: 0 };
}

/** Build a disabled-phase summary for the Docker metrics phase. */
export function disabledDockerMetricsSummary() {
  return { enabled: false, attempted: 0, submitted: 0, skippedRecent: 0, failed: 0 };
}
