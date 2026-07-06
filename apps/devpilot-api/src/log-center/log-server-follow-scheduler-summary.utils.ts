import { ScheduledServerFollowSummary } from "./log-server-follow-scheduler.types";

export function buildEmptyServerFollowSummary(
  skipped: boolean,
  enabled: boolean,
  dryRun: boolean,
): ScheduledServerFollowSummary {
  return {
    skipped,
    enabled,
    dryRun,
    scanned: 0,
    attempted: 0,
    queued: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
    skippedStreams: 0,
    ingestedEntryCount: 0,
  };
}
