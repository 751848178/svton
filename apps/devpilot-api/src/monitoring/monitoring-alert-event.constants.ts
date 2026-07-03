import { Prisma } from "@prisma/client";

export const alertEventInclude = Prisma.validator<Prisma.AlertEventInclude>()({
  rule: {
    select: {
      id: true,
      projectId: true,
      environmentId: true,
      name: true,
      metric: true,
      severity: true,
      enabled: true,
    },
  },
  actor: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: {
    select: { id: true, name: true, kind: true, status: true },
  },
  server: { select: { id: true, name: true, host: true, status: true } },
  site: { select: { id: true, name: true, primaryDomain: true, status: true } },
  managedResource: {
    select: {
      id: true,
      name: true,
      sourceType: true,
      provider: true,
      kind: true,
      status: true,
      endpoint: true,
    },
  },
  backupPlan: {
    select: {
      id: true,
      name: true,
      status: true,
      lastStatus: true,
      lastRunAt: true,
    },
  },
});
