import { Prisma } from "@prisma/client";
import type { alertNotificationDeliveryInclude } from "./monitoring-notification-delivery.constants";

export type AlertNotificationDeliveryRecord =
  Prisma.AlertNotificationDeliveryGetPayload<{
    include: typeof alertNotificationDeliveryInclude;
  }>;
