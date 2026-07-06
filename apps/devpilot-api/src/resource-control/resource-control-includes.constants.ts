/**
 * Shared Prisma `include` shapes for the resource-control feature.
 *
 * Extracted verbatim from `ResourceControlService`'s private include helpers
 * (`managedResourceInclude`, `actionRunInclude`, `metricSnapshotInclude`,
 * `connectionRunInclude`, `queryRunInclude`) so the repository, the focused
 * services, and the facade can reuse one definition each.
 */

export const managedResourceInclude = {
  server: { select: { id: true, name: true, host: true, status: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  resourceInstance: {
    select: {
      id: true, name: true, status: true,
      resourceType: { select: { id: true, key: true, name: true } },
    },
  },
  credential: { select: { id: true, name: true, type: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

const resourceReadShape = {
  id: true, projectId: true, environmentId: true, name: true,
  provider: true, kind: true, sourceType: true, endpoint: true,
  server: { select: { id: true, name: true, host: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  credential: { select: { id: true, name: true, type: true } },
} as const;

export const actionRunInclude = {
  resource: { select: resourceReadShape },
  actor: { select: { id: true, name: true, email: true } },
  credential: { select: { id: true, name: true, type: true } },
  operationApproval: {
    select: { id: true, status: true, risk: true, reviewedAt: true, consumedAt: true },
  },
  serverExecutionJob: {
    select: {
      id: true, status: true, queueMode: true, attempt: true, maxAttempts: true,
      queuedAt: true, startedAt: true, finishedAt: true,
    },
  },
} as const;

export const metricSnapshotInclude = {
  resource: { select: resourceReadShape },
  resourceActionRun: {
    select: { id: true, action: true, status: true, dryRun: true, startedAt: true, finishedAt: true },
  },
  server: { select: { id: true, name: true, host: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
} as const;

export const connectionRunInclude = {
  resource: { select: resourceReadShape },
  actor: { select: { id: true, name: true, email: true } },
  credential: { select: { id: true, name: true, type: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  server: { select: { id: true, name: true, host: true, status: true } },
} as const;

export const queryRunInclude = {
  resource: { select: resourceReadShape },
  actor: { select: { id: true, name: true, email: true } },
  credential: { select: { id: true, name: true, type: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  server: { select: { id: true, name: true, host: true, status: true } },
} as const;
