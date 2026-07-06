import { Prisma } from '@prisma/client';

export const alertRuleInclude = Prisma.validator<Prisma.AlertRuleInclude>()({
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: {
    select: { id: true, name: true, kind: true, status: true },
  },
  server: { select: { id: true, name: true, host: true, status: true } },
  site: {
    select: {
      id: true,
      name: true,
      primaryDomain: true,
      status: true,
      tls: true,
    },
  },
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
  events: {
    orderBy: { occurredAt: 'desc' },
    take: 3,
    select: {
      id: true,
      projectId: true,
      environmentId: true,
      status: true,
      severity: true,
      summary: true,
      occurredAt: true,
      resolvedAt: true,
    },
  },
});
