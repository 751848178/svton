import { Prisma } from "@prisma/client";

const OPERATION_APPROVAL_RUN_SELECT = {
  id: true,
  action: true,
  status: true,
  dryRun: true,
  startedAt: true,
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
} satisfies Prisma.ResourceActionRunSelect;

export const OPERATION_APPROVAL_INCLUDE = {
  requester: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: {
    select: { id: true, name: true, kind: true, runtime: true },
  },
  server: { select: { id: true, name: true, host: true } },
  site: { select: { id: true, name: true, primaryDomain: true } },
  managedResource: {
    select: {
      id: true,
      name: true,
      sourceType: true,
      provider: true,
      kind: true,
      endpoint: true,
    },
  },
  resourceActionRuns: {
    orderBy: { startedAt: "desc" },
    take: 3,
    select: OPERATION_APPROVAL_RUN_SELECT,
  },
  applicationServiceOperationRuns: {
    orderBy: { startedAt: "desc" },
    take: 3,
    select: OPERATION_APPROVAL_RUN_SELECT,
  },
  siteSyncRuns: {
    orderBy: { startedAt: "desc" },
    take: 3,
    select: {
      id: true,
      mode: true,
      status: true,
      dryRun: true,
      startedAt: true,
      targetConfigPath: true,
    },
  },
  deploymentRuns: {
    orderBy: { startedAt: "desc" },
    take: 3,
    select: {
      id: true,
      mode: true,
      status: true,
      dryRun: true,
      startedAt: true,
      branch: true,
      commitSha: true,
    },
  },
} satisfies Prisma.OperationApprovalInclude;
