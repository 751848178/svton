import { ScheduledSlsBackfillSummary } from "./log-sls-backfill-scheduler.types";

export function buildEmptySlsBackfillSummary(
  skipped: boolean,
  enabled: boolean,
  dryRun: boolean,
): ScheduledSlsBackfillSummary {
  return {
    skipped,
    enabled,
    dryRun,
    scanned: 0,
    attempted: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
    skippedStreams: 0,
    ingestedEntryCount: 0,
  };
}
