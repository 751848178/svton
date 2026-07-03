export const alertCategories = [
  "service",
  "server",
  "site",
  "resource",
  "backup",
  "deployment",
  "log",
] as const;

export const alertSeverities = ["info", "warning", "critical"] as const;

export const alertEvaluationModes = ["manual", "schedule", "webhook"] as const;

export const alertSilenceStatuses = ["active", "paused", "archived"] as const;

export const alertNotificationChannelTypes = [
  "webhook",
  "feishu",
  "dingtalk",
  "wecom",
  "email",
] as const;

export const alertNotificationEventStatuses = [
  "firing",
  "error",
  "insufficient_data",
  "resolved",
  "acknowledged",
] as const;

export type AlertCategory = (typeof alertCategories)[number];
export type AlertSeverity = (typeof alertSeverities)[number];
export type AlertEvaluationMode = (typeof alertEvaluationModes)[number];
export type AlertSilenceStatus = (typeof alertSilenceStatuses)[number];
export type AlertNotificationChannelType =
  (typeof alertNotificationChannelTypes)[number];
