export type AlertEscalationOptions = {
  now?: Date;
  batchSize?: number;
  minAgeSeconds?: number;
  dedupeWindowMinutes?: number;
  severities?: string[];
};

export type AlertEscalationSummary = {
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  skippedNoChannels: number;
  skippedAlreadyEscalated: number;
};
