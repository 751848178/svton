import { Prisma } from "@prisma/client";

export function buildServerExecutionJobInclude(): Prisma.ServerExecutionJobInclude {
  return {
    actor: { select: { id: true, name: true, email: true } },
    server: { select: { id: true, name: true, host: true, status: true } },
    retryOf: {
      select: { id: true, status: true, operationKey: true, queuedAt: true },
    },
    retryAttempts: {
      select: { id: true, status: true, queuedAt: true, finishedAt: true },
      orderBy: { queuedAt: "desc" },
      take: 5,
    },
    deploymentRuns: {
      select: { id: true, projectId: true, environmentId: true },
      take: 5,
    },
    siteSyncRuns: {
      select: { id: true, projectId: true, environmentId: true },
      take: 5,
    },
    resourceActionRuns: {
      select: {
        id: true,
        resource: { select: { projectId: true, environmentId: true } },
      },
      take: 5,
    },
    applicationServiceOperationRuns: {
      select: { id: true, projectId: true, environmentId: true },
      take: 5,
    },
    backupRuns: {
      select: { id: true, projectId: true, environmentId: true },
      take: 5,
    },
    logCollectionRuns: {
      select: { id: true, projectId: true, environmentId: true },
      take: 5,
    },
  };
}
