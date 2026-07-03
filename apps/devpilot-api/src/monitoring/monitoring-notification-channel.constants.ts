import { Prisma } from "@prisma/client";

export const alertNotificationChannelDispatchSelect =
  Prisma.validator<Prisma.AlertNotificationChannelSelect>()({
    id: true,
    teamId: true,
    projectId: true,
    environmentId: true,
    name: true,
    type: true,
    status: true,
    config: true,
    secretConfig: true,
    eventStatuses: true,
    severityFilter: true,
  });

export const alertNotificationChannelSelect =
  Prisma.validator<Prisma.AlertNotificationChannelSelect>()({
    id: true,
    teamId: true,
    createdById: true,
    projectId: true,
    environmentId: true,
    name: true,
    type: true,
    status: true,
    config: true,
    eventStatuses: true,
    severityFilter: true,
    lastStatus: true,
    lastDeliveredAt: true,
    lastError: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, name: true, email: true } },
  });
