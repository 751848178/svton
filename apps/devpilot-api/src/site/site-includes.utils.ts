/**
 * Shared Prisma include shapes for the site module.
 *
 * Extracted from `SiteService` private `siteInclude()`/`syncRunInclude()` methods
 * so the god service and any focused service/utils can share the same include
 * constants without re-declaring them. Pure constants.
 */

import { Prisma } from '@prisma/client';

export const SITE_INCLUDE = {
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  server: { select: { id: true, name: true, host: true, status: true } },
  proxyConfig: { select: { id: true, name: true, domain: true, status: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SiteInclude;

export const SYNC_RUN_INCLUDE = {
  actor: { select: { id: true, name: true, email: true } },
  operationApproval: { select: { id: true, status: true, risk: true, reviewedAt: true, consumedAt: true } },
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
  sourceRun: {
    select: {
      id: true,
      mode: true,
      status: true,
      dryRun: true,
      startedAt: true,
      targetConfigPath: true,
    },
  },
} satisfies Prisma.SiteSyncRunInclude;
