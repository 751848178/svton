import { Prisma } from "@prisma/client";
import type { ReleaseOrderLifecycleStatus } from "./release-order-lifecycle.types";
import {
  lifecycleFailureKindCase,
  lifecycleStatusCase,
} from "./release-order-lifecycle-policy.query";
import {
  governedProductionDeploymentExists,
  releaseRunCompletionEvidenceExists,
  succeededProductionDeploymentExists,
} from "./release-order-production-evidence.query";
import { releaseOrderResumeStepCte } from "./release-order-resume-step.query";

export function releaseOrderLifecycleCtes() {
  return Prisma.sql`
    lifecycle_deployments AS (
      SELECT dr.id, am.releaseOrderId, dr.environmentId,
        pe.baselineRole AS environmentRole, dr.status,
        dr.artifactManifestId, dr.releaseRunId,
        COALESCE(dr.finishedAt, dr.startedAt, dr.createdAt) AS occurredAt,
        IF(pe.baselineRole = 'production',
          ${governedProductionDeploymentExists()}, TRUE
        ) AS productionEvidenceValid,
        IF(pe.baselineRole = 'production',
          ${succeededProductionDeploymentExists()}, FALSE
        ) AS productionSucceeded
      FROM DeploymentRun dr
      INNER JOIN ArtifactManifest am
        ON am.id = dr.artifactManifestId
        AND am.teamId = dr.teamId AND am.projectId = dr.projectId
      INNER JOIN BuildRun br
        ON br.id = am.buildRunId
        AND br.releaseOrderId = am.releaseOrderId
        AND br.teamId = am.teamId AND br.projectId = am.projectId
      INNER JOIN ProjectEnvironment pe
        ON pe.id = dr.environmentId
        AND pe.teamId = dr.teamId AND pe.projectId = dr.projectId
        AND pe.status = 'active'
        AND pe.baselineRole IN ('staging', 'production')
      INNER JOIN scoped_orders so
        ON so.id = am.releaseOrderId
        AND so.teamId = dr.teamId AND so.projectId = dr.projectId
      WHERE dr.source = 'release_order' AND dr.dryRun = FALSE
    ),
    lifecycle_events AS (
      SELECT so.id AS releaseOrderId, 'order_created' AS sourceType,
        so.id AS sourceId, 'preflight' AS phase, 'created' AS sourceStatus,
        so.createdAt AS occurredAt, 0 AS tiePriority,
        NULL AS approvalStatus, TRUE AS productionEvidenceValid,
        FALSE AS productionSucceeded
      FROM scoped_orders so
      UNION ALL
      SELECT br.releaseOrderId, 'build_run', br.id, 'build', br.status,
        COALESCE(br.finishedAt, br.startedAt, br.createdAt), 1, NULL, TRUE, FALSE
      FROM BuildRun br INNER JOIN scoped_orders so
        ON so.id = br.releaseOrderId
        AND so.teamId = br.teamId AND so.projectId = br.projectId
      UNION ALL
      SELECT ld.releaseOrderId, 'deployment_run', ld.id,
        ld.environmentRole, ld.status, ld.occurredAt,
        IF(ld.environmentRole = 'production', 3, 2), NULL,
        ld.productionEvidenceValid,
        ld.productionSucceeded
      FROM lifecycle_deployments ld
      UNION ALL
      SELECT rr.releaseOrderId, 'release_run', rr.id, 'production', rr.status,
        CASE
          WHEN rr.status IN ('pending', 'awaiting_approval')
            AND oa.status = 'pending' THEN oa.requestedAt
          WHEN rr.status IN ('pending', 'awaiting_approval')
            AND oa.status IN ('approved', 'rejected', 'cancelled')
            THEN oa.reviewedAt
          ELSE COALESCE(rr.finishedAt, rr.startedAt, rr.createdAt)
        END, 4, oa.status, TRUE,
        ${releaseRunCompletionEvidenceExists()}
      FROM ReleaseRun rr
      INNER JOIN ArtifactManifest am
        ON am.id = rr.artifactManifestId
        AND am.releaseOrderId = rr.releaseOrderId
        AND am.teamId = rr.teamId AND am.projectId = rr.projectId
        AND am.digest = rr.verifiedDigest
      INNER JOIN ProjectEnvironment pe
        ON pe.id = rr.environmentId
        AND pe.teamId = rr.teamId AND pe.projectId = rr.projectId
        AND pe.status = 'active' AND pe.baselineRole = 'production'
      LEFT JOIN OperationApproval oa
        ON oa.id = rr.operationApprovalId
        AND oa.teamId = rr.teamId AND oa.projectId = rr.projectId
        AND oa.environmentId = rr.environmentId
        AND oa.category = 'release'
        AND oa.targetType = 'release_run' AND oa.targetId = rr.id
        AND oa.action = 'project.release_order.deploy_production'
        AND oa.inputHash = rr.inputHash
        AND (
          oa.status = 'pending'
          OR (oa.status IN ('approved', 'rejected', 'cancelled')
            AND oa.reviewedAt IS NOT NULL)
        )
      INNER JOIN scoped_orders so
        ON so.id = rr.releaseOrderId
        AND so.teamId = rr.teamId AND so.projectId = rr.projectId
    ),
    ranked_lifecycle_events AS (
      SELECT event.*, ROW_NUMBER() OVER (
        PARTITION BY releaseOrderId
        ORDER BY occurredAt DESC, tiePriority DESC, sourceId DESC
      ) AS eventRank
      FROM lifecycle_events event
    ),
    ranked_withdrawals AS (
      SELECT ae.id, ae.targetId AS releaseOrderId, ae.occurredAt,
        ROW_NUMBER() OVER (
          PARTITION BY ae.targetId ORDER BY ae.occurredAt DESC, ae.id DESC
        ) AS withdrawalRank
      FROM AuditEvent ae INNER JOIN scoped_orders so
        ON so.id = ae.targetId
        AND so.teamId = ae.teamId AND so.projectId = ae.projectId
      WHERE ae.category = 'release'
        AND ae.action = 'project.release_order.withdraw'
        AND ae.targetType = 'release_order' AND ae.status = 'completed'
    ),
    lifecycle_orders AS (
      SELECT so.*, so.status AS persistedStatus,
        ${lifecycleStatusCase()} AS lifecycleStatus,
        ${lifecycleFailureKindCase()} AS lifecycleFailureKind,
        le.phase AS lifecyclePhase,
        IF(so.status = 'canceled', 'withdrawal', le.sourceType)
          AS lifecycleSourceType,
        IF(so.status = 'canceled', COALESCE(rw.id, so.id), le.sourceId)
          AS lifecycleSourceId,
        IF(so.status = 'canceled', 'canceled', le.sourceStatus)
          AS lifecycleSourceStatus,
        IF(so.status = 'canceled', COALESCE(rw.occurredAt, so.updatedAt), le.occurredAt)
          AS lifecycleOccurredAt
      FROM scoped_orders so
      INNER JOIN ranked_lifecycle_events le
        ON le.releaseOrderId = so.id AND le.eventRank = 1
      LEFT JOIN ranked_withdrawals rw
        ON rw.releaseOrderId = so.id AND rw.withdrawalRank = 1
    )
  `;
}

export function releaseOrderLifecycleStatusFilter(
  status?: ReleaseOrderLifecycleStatus,
) {
  return status ? Prisma.sql`lo.lifecycleStatus = ${status}` : Prisma.sql`TRUE`;
}

export function releaseOrderLifecycleDetailQuery(input: {
  teamId: string;
  projectId: string;
  releaseOrderId: string;
}) {
  return Prisma.sql`
    WITH scoped_orders AS (
      SELECT ro.id, ro.teamId, ro.projectId, ro.releaseVersion,
        ro.note, ro.status, ro.createdAt, ro.updatedAt
      FROM ReleaseOrder ro INNER JOIN Project p
        ON p.id = ro.projectId AND p.teamId = ro.teamId
      WHERE ro.id = ${input.releaseOrderId}
        AND ro.teamId = ${input.teamId} AND ro.projectId = ${input.projectId}
        AND p.archivedAt IS NULL
    ),
    ${releaseOrderLifecycleCtes()},
    ${releaseOrderResumeStepCte()}
    SELECT persistedStatus, lifecycleStatus, lifecyclePhase,
      lifecycleSourceType, lifecycleSourceId, lifecycleSourceStatus,
      lifecycleOccurredAt, lifecycleFailureKind, frp.resumeStep
    FROM lifecycle_orders lo
    INNER JOIN furthest_release_phase frp ON frp.releaseOrderId = lo.id
  `;
}
