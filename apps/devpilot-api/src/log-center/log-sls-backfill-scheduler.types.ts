export type ScheduledSlsBackfillSummary = {
  skipped: boolean;
  enabled: boolean;
  dryRun: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  blocked: number;
  skippedStreams: number;
  ingestedEntryCount: number;
};

export type SlsBackfillConfig = {
  enabled: boolean;
  live: boolean;
  confirmLiveRead: boolean;
  query: string;
  windowMinutes: number;
  limit: number;
  intervalMinutes: number;
};
