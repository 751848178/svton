export type ScheduledAlertNotificationRetrySummary = {
  enabled: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  skippedSuperseded: number;
  skippedMaxAttempts: number;
};

export type ScheduledAlertEscalationSummary = {
  enabled: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  skippedNoChannels: number;
  skippedAlreadyEscalated: number;
};

export type ScheduledAlertEvaluationSummary = {
  skipped: boolean;
  enabled: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
  skippedNotDue: number;
  notificationRetries: ScheduledAlertNotificationRetrySummary;
  alertEscalations: ScheduledAlertEscalationSummary;
};

export type ScheduledMetricCollectionSummary = {
  skipped: boolean;
  enabled: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  failed: number;
};
