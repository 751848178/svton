import type {
  ScheduledAlertEscalationSummary,
  ScheduledAlertEvaluationSummary,
  ScheduledAlertNotificationRetrySummary,
} from "./monitoring-scheduler.types";

export function createScheduledAlertEvaluationSummary(
  skipped: boolean,
  enabled: boolean,
  notificationRetriesEnabled = false,
  alertEscalationsEnabled = false,
): ScheduledAlertEvaluationSummary {
  return {
    skipped,
    enabled,
    scanned: 0,
    attempted: 0,
    completed: 0,
    failed: 0,
    skippedNotDue: 0,
    notificationRetries: createScheduledNotificationRetrySummary(
      notificationRetriesEnabled,
    ),
    alertEscalations: createScheduledAlertEscalationSummary(
      alertEscalationsEnabled,
    ),
  };
}

export function createScheduledNotificationRetrySummary(
  enabled: boolean,
): ScheduledAlertNotificationRetrySummary {
  return {
    enabled,
    scanned: 0,
    attempted: 0,
    completed: 0,
    failed: 0,
    skippedSuperseded: 0,
    skippedMaxAttempts: 0,
  };
}

export function createScheduledAlertEscalationSummary(
  enabled: boolean,
): ScheduledAlertEscalationSummary {
  return {
    enabled,
    scanned: 0,
    attempted: 0,
    completed: 0,
    failed: 0,
    skippedNoChannels: 0,
    skippedAlreadyEscalated: 0,
  };
}
