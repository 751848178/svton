export type AlertNotificationAutoRetryOptions = {
  now?: Date;
  batchSize?: number;
  minAgeSeconds?: number;
  maxAttempts?: number;
  attemptWindowMinutes?: number;
  userId?: string | null;
};

export type AlertNotificationAutoRetrySummary = {
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  skippedSuperseded: number;
  skippedMaxAttempts: number;
};
