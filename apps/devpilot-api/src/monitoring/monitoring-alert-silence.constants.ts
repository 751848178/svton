import { Prisma } from "@prisma/client";

export const alertSilenceSelect = Prisma.validator<Prisma.AlertSilenceSelect>()(
  {
    id: true,
    teamId: true,
    createdById: true,
    projectId: true,
    environmentId: true,
    name: true,
    status: true,
    category: true,
    metric: true,
    severityFilter: true,
    startsAt: true,
    endsAt: true,
    reason: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, name: true, email: true } },
    project: { select: { id: true, name: true } },
    environment: { select: { id: true, key: true, name: true, status: true } },
  },
);
