import { Prisma } from "@prisma/client";

export function lifecycleStatusCase() {
  return Prisma.sql`CASE
    WHEN so.status = 'canceled' THEN 'withdrawn'
    WHEN le.sourceType = 'order_created' AND so.status = 'failed' THEN 'failed'
    WHEN le.sourceType = 'order_created' THEN 'draft'
    WHEN le.sourceType = 'build_run'
      AND le.sourceStatus IN ('queued', 'running') THEN 'building'
    WHEN le.sourceType = 'build_run' AND le.sourceStatus = 'succeeded' THEN 'staging'
    WHEN le.sourceType = 'deployment_run' AND le.phase = 'staging'
      AND le.sourceStatus IN ('running', 'completed') THEN 'staging'
    WHEN le.sourceType = 'release_run'
      AND le.sourceStatus IN ('pending', 'awaiting_approval')
      AND le.approvalStatus = 'pending' THEN 'awaiting_approval'
    WHEN le.sourceType = 'release_run'
      AND le.sourceStatus IN ('pending', 'awaiting_approval')
      AND le.approvalStatus = 'approved' THEN 'production'
    WHEN le.sourceType = 'release_run' AND le.sourceStatus = 'running'
      AND le.approvalStatus = 'approved' THEN 'production'
    WHEN le.sourceType = 'release_run' AND le.sourceStatus = 'succeeded'
      AND le.productionSucceeded = TRUE THEN 'succeeded'
    WHEN le.sourceType = 'deployment_run' AND le.phase = 'production'
      AND le.productionEvidenceValid = FALSE THEN 'failed'
    WHEN le.sourceType = 'deployment_run' AND le.phase = 'production'
      AND le.sourceStatus = 'completed'
      AND le.productionSucceeded = TRUE THEN 'succeeded'
    WHEN le.sourceType = 'deployment_run' AND le.phase = 'production'
      AND le.sourceStatus IN ('running', 'completed') THEN 'production'
    ELSE 'failed'
  END`;
}

export function lifecycleFailureKindCase() {
  return Prisma.sql`CASE
    WHEN so.status = 'canceled' THEN NULL
    WHEN le.sourceType = 'order_created' AND so.status = 'failed' THEN 'failed'
    WHEN le.sourceType = 'build_run' AND le.sourceStatus = 'failed' THEN 'failed'
    WHEN le.sourceType = 'build_run' AND le.sourceStatus = 'canceled' THEN 'canceled'
    WHEN le.sourceType = 'deployment_run' AND le.phase = 'production'
      AND le.productionEvidenceValid = FALSE THEN 'evidence_mismatch'
    WHEN le.sourceType = 'deployment_run' AND le.sourceStatus = 'failed' THEN 'failed'
    WHEN le.sourceType = 'deployment_run' AND le.sourceStatus = 'blocked' THEN 'blocked'
    WHEN le.sourceType = 'release_run' AND le.sourceStatus = 'failed' THEN 'failed'
    WHEN le.sourceType = 'release_run' AND le.sourceStatus = 'canceled' THEN 'canceled'
    WHEN le.sourceType = 'release_run'
      AND le.sourceStatus IN ('pending', 'awaiting_approval')
      AND le.approvalStatus = 'rejected' THEN 'failed'
    WHEN le.sourceType = 'release_run'
      AND le.sourceStatus IN ('pending', 'awaiting_approval')
      AND le.approvalStatus = 'cancelled' THEN 'canceled'
    WHEN le.sourceType = 'release_run'
      AND le.sourceStatus IN ('pending', 'awaiting_approval')
      AND le.approvalStatus IS NULL THEN 'evidence_mismatch'
    WHEN le.sourceType = 'release_run' AND le.sourceStatus = 'running'
      AND (le.approvalStatus IS NULL OR le.approvalStatus != 'approved')
      THEN 'evidence_mismatch'
    WHEN le.sourceType = 'release_run' AND le.sourceStatus = 'succeeded'
      AND le.productionSucceeded = FALSE THEN 'evidence_mismatch'
    ELSE NULL
  END`;
}
