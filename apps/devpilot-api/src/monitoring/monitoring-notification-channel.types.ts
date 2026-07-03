import { Prisma } from "@prisma/client";
import type { alertNotificationChannelDispatchSelect } from "./monitoring-notification-channel.constants";

export type AlertNotificationChannelDispatchRecord =
  Prisma.AlertNotificationChannelGetPayload<{
    select: typeof alertNotificationChannelDispatchSelect;
  }>;

export type AlertNotificationChannelType =
  | "webhook"
  | "feishu"
  | "dingtalk"
  | "wecom"
  | "email";

export type AlertNotificationChannelSettings = {
  config: Record<string, unknown>;
  secretConfig: Record<string, unknown>;
};
