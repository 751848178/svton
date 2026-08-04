import { Prisma } from "@prisma/client";
import { releaseOrderListFilter } from "./release-order-list-filter.query";
import type { ReleaseOrderListQueryInput } from "./release-order-list.types";
import {
  releaseOrderLifecycleCtes,
  releaseOrderLifecycleStatusFilter,
} from "./release-order-lifecycle.query";

export function releaseOrderListCountQuery(input: ReleaseOrderListQueryInput) {
  return Prisma.sql`
    WITH scoped_orders AS (
      SELECT ro.id, ro.teamId, ro.projectId, ro.releaseVersion,
        ro.note, ro.status, ro.createdAt, ro.updatedAt
      FROM ReleaseOrder ro
      INNER JOIN Project p
        ON p.id = ro.projectId AND p.teamId = ro.teamId
      WHERE ${releaseOrderListFilter(input)}
    ),
    ${releaseOrderLifecycleCtes()}
    SELECT COUNT(*) AS total
    FROM lifecycle_orders lo
    WHERE ${releaseOrderLifecycleStatusFilter(input.status)}
  `;
}

export function releaseOrderListRowsQuery(input: ReleaseOrderListQueryInput) {
  return Prisma.sql`
    WITH scoped_orders AS (
      SELECT ro.id, ro.teamId, ro.projectId, ro.releaseVersion,
        ro.note, ro.status, ro.createdAt, ro.updatedAt
      FROM ReleaseOrder ro
      INNER JOIN Project p
        ON p.id = ro.projectId AND p.teamId = ro.teamId
      WHERE ${releaseOrderListFilter(input)}
    ),
    ${releaseOrderLifecycleCtes()},
    deployment_events AS (
      SELECT dr.id, am.releaseOrderId, dr.environmentId,
        pe.baselineRole AS environmentRole, pe.name AS environmentName,
        dr.status, dr.artifactManifestId, br.id AS buildRunId,
        COALESCE(dr.finishedAt, dr.startedAt, dr.createdAt) AS occurredAt
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
    execution_events AS (
      SELECT so.id AS releaseOrderId, 'order_created' AS sourceType,
        so.id AS sourceId, 'preflight' AS step, 'created' AS status,
        so.createdAt AS occurredAt, 0 AS tiePriority
      FROM scoped_orders so
      UNION ALL
      SELECT br.releaseOrderId, 'build_run', br.id, 'build', br.status,
        COALESCE(br.finishedAt, br.startedAt, br.createdAt), 1
      FROM BuildRun br INNER JOIN scoped_orders so
        ON so.id = br.releaseOrderId
        AND so.teamId = br.teamId AND so.projectId = br.projectId
      UNION ALL
      SELECT de.releaseOrderId, 'deployment_run', de.id,
        de.environmentRole, de.status, de.occurredAt,
        IF(de.environmentRole = 'production', 3, 2)
      FROM deployment_events de
      UNION ALL
      SELECT rr.releaseOrderId, 'release_run', rr.id, 'production', rr.status,
        COALESCE(rr.finishedAt, rr.startedAt, rr.createdAt), 4
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
      INNER JOIN scoped_orders so
        ON so.id = rr.releaseOrderId
        AND so.teamId = rr.teamId AND so.projectId = rr.projectId
    ),
    ranked_events AS (
      SELECT ee.*, ROW_NUMBER() OVER (
        PARTITION BY releaseOrderId
        ORDER BY occurredAt DESC, tiePriority DESC, sourceId DESC
      ) AS eventRank FROM execution_events ee
    ),
    ranked_builds AS (
      SELECT br.*, ROW_NUMBER() OVER (
        PARTITION BY br.releaseOrderId ORDER BY br.revision DESC, br.id DESC
      ) AS buildRank
      FROM BuildRun br INNER JOIN scoped_orders so
        ON so.id = br.releaseOrderId
        AND so.teamId = br.teamId AND so.projectId = br.projectId
    ),
    ranked_manifests AS (
      SELECT am.id, am.digest, am.buildRunId, am.createdAt,
        br.releaseOrderId, br.revision, ROW_NUMBER() OVER (
          PARTITION BY br.releaseOrderId
          ORDER BY br.revision DESC, am.createdAt DESC, am.id DESC
        ) AS manifestRank
      FROM BuildRun br INNER JOIN ArtifactManifest am
        ON am.buildRunId = br.id AND am.releaseOrderId = br.releaseOrderId
        AND am.teamId = br.teamId AND am.projectId = br.projectId
      INNER JOIN scoped_orders so
        ON so.id = br.releaseOrderId
        AND so.teamId = br.teamId AND so.projectId = br.projectId
      WHERE br.status = 'succeeded'
    ),
    build_counts AS (
      SELECT br.releaseOrderId, COUNT(*) AS buildCount
      FROM BuildRun br INNER JOIN scoped_orders so
        ON so.id = br.releaseOrderId
        AND so.teamId = br.teamId AND so.projectId = br.projectId
      GROUP BY br.releaseOrderId
    ),
    ranked_deployments AS (
      SELECT de.*, ROW_NUMBER() OVER (
        PARTITION BY de.releaseOrderId
        ORDER BY de.occurredAt DESC, de.id DESC
      ) AS deploymentRank,
      COUNT(*) OVER (PARTITION BY de.releaseOrderId) AS deploymentCount
      FROM deployment_events de
    )
    SELECT lo.*, COALESCE(lb.sourceBranch, rir.defaultBranch) AS sourceBranch,
      lb.sourceCommitSha, lb.id AS buildRunId, lb.revision AS buildRevision,
      lb.status AS buildStatus, COALESCE(bc.buildCount, 0) AS buildCount,
      rm.id AS manifestId, rm.digest AS manifestDigest,
      rm.buildRunId AS manifestBuildRunId, rm.revision AS manifestBuildRevision,
      rm.createdAt AS manifestCreatedAt,
      COALESCE(ld.deploymentCount, 0) AS deploymentCount,
      ld.id AS deploymentId, ld.environmentId, ld.environmentRole,
      ld.environmentName, ld.status AS deploymentStatus,
      ld.artifactManifestId, ld.buildRunId AS deploymentBuildRunId,
      ld.occurredAt AS deploymentOccurredAt,
      le.sourceType, le.sourceId, le.step, le.status AS executionStatus,
      le.occurredAt AS lastExecutedAt
    FROM scoped_orders so
    INNER JOIN lifecycle_orders lo ON lo.id = so.id
    LEFT JOIN ranked_builds lb ON lb.releaseOrderId = so.id AND lb.buildRank = 1
    LEFT JOIN build_counts bc ON bc.releaseOrderId = so.id
    LEFT JOIN ranked_manifests rm
      ON rm.releaseOrderId = so.id AND rm.manifestRank = 1
    LEFT JOIN ranked_deployments ld
      ON ld.releaseOrderId = so.id AND ld.deploymentRank = 1
    INNER JOIN ranked_events le ON le.releaseOrderId = so.id AND le.eventRank = 1
    LEFT JOIN ProjectRepositoryIdentity pri
      ON pri.teamId = so.teamId AND pri.projectId = so.projectId
      AND pri.lockedAt IS NOT NULL
    LEFT JOIN ProjectRepositoryIdentityRevision rir
      ON rir.id = pri.currentRevisionId AND rir.identityId = pri.id
      AND rir.teamId = so.teamId AND rir.projectId = so.projectId
    WHERE ${releaseOrderLifecycleStatusFilter(input.status)}
    ORDER BY le.occurredAt DESC, so.createdAt DESC, so.id DESC
    LIMIT ${input.take}
  `;
}
