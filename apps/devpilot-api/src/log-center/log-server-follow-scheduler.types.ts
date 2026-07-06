export type ScheduledServerFollowSummary = {
  skipped: boolean;
  enabled: boolean;
  dryRun: boolean;
  scanned: number;
  attempted: number;
  queued: number;
  completed: number;
  failed: number;
  blocked: number;
  skippedStreams: number;
  ingestedEntryCount: number;
};
