import { Prisma } from "@prisma/client";

export const logStreamInclude = Prisma.validator<Prisma.LogStreamInclude>()({
  createdBy: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: {
    select: {
      id: true,
      name: true,
      kind: true,
      runtime: true,
      status: true,
      deployConfig: true,
    },
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
      externalId: true,
      credentialId: true,
      config: true,
      metadata: true,
    },
  },
  deploymentRun: {
    select: { id: true, source: true, trigger: true, status: true },
  },
  backupPlan: {
    select: { id: true, name: true, status: true, lastStatus: true },
  },
  backupRun: {
    select: { id: true, backupType: true, status: true, dryRun: true },
  },
  alertEvent: {
    select: { id: true, metric: true, severity: true, status: true },
  },
  _count: { select: { entries: true } },
});

export const logEntryInclude = Prisma.validator<Prisma.LogEntryInclude>()({
  stream: {
    select: {
      id: true,
      projectId: true,
      environmentId: true,
      name: true,
      sourceType: true,
      status: true,
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
  deploymentRun: {
    select: { id: true, source: true, trigger: true, status: true },
  },
  backupPlan: {
    select: { id: true, name: true, status: true, lastStatus: true },
  },
  backupRun: {
    select: { id: true, backupType: true, status: true, dryRun: true },
  },
  alertEvent: {
    select: { id: true, metric: true, severity: true, status: true },
  },
});

export const logCollectionRunInclude =
  Prisma.validator<Prisma.LogCollectionRunInclude>()({
    actor: { select: { id: true, name: true, email: true } },
    stream: {
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        name: true,
        sourceType: true,
        sourceKey: true,
        status: true,
      },
    },
    project: { select: { id: true, name: true } },
    environment: { select: { id: true, key: true, name: true, status: true } },
    application: { select: { id: true, name: true, status: true } },
    applicationService: {
      select: { id: true, name: true, kind: true, status: true },
    },
    server: { select: { id: true, name: true, host: true, status: true } },
    site: {
      select: { id: true, name: true, primaryDomain: true, status: true },
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
    deploymentRun: {
      select: { id: true, source: true, trigger: true, status: true },
    },
    backupPlan: {
      select: { id: true, name: true, status: true, lastStatus: true },
    },
    backupRun: {
      select: { id: true, backupType: true, status: true, dryRun: true },
    },
    alertEvent: {
      select: { id: true, metric: true, severity: true, status: true },
    },
    serverExecutionJob: {
      select: {
        id: true,
        status: true,
        queueMode: true,
        attempt: true,
        maxAttempts: true,
        queuedAt: true,
        startedAt: true,
        finishedAt: true,
      },
    },
  });

export const logRetentionRunInclude =
  Prisma.validator<Prisma.LogRetentionRunInclude>()({
    actor: { select: { id: true, name: true, email: true } },
    stream: {
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        name: true,
        sourceType: true,
        status: true,
        retentionDays: true,
      },
    },
  });
