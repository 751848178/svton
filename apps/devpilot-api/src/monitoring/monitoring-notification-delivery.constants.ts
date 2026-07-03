import { Prisma } from "@prisma/client";

export const alertNotificationDeliveryInclude =
  Prisma.validator<Prisma.AlertNotificationDeliveryInclude>()({
    channel: {
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        projectId: true,
        environmentId: true,
        config: true,
      },
    },
    alertEvent: {
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        category: true,
        metric: true,
        severity: true,
        status: true,
        summary: true,
        occurredAt: true,
        rule: { select: { id: true, name: true } },
      },
    },
  });
