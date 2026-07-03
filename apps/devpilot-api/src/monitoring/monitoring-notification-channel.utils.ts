import type { AlertNotificationChannelType } from "./monitoring-notification-channel.types";

export function normalizeNotificationChannelType(
  value?: string | null,
): AlertNotificationChannelType {
  if (
    value === "feishu" ||
    value === "dingtalk" ||
    value === "wecom" ||
    value === "email"
  ) {
    return value;
  }
  return "webhook";
}
