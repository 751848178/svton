import {
  RELEASE_ORDER_LIST_STATUSES,
  type ReleaseOrderListItem,
  type ReleaseOrderListSourceType,
  type ReleaseOrderListStatus,
  type ReleaseOrderListStep,
} from "./release-order-list.types";

export interface ReleaseOrderListRow {
  id: string;
  projectId: string;
  releaseVersion: string;
  note: string | null;
  status: string;
  createdAt: Date;
  sourceBranch: string | null;
  sourceCommitSha: string | null;
  buildRunId: string | null;
  buildRevision: number | null;
  buildStatus: string | null;
  buildCount: bigint | number;
  manifestId: string | null;
  manifestDigest: string | null;
  manifestBuildRunId: string | null;
  manifestBuildRevision: number | null;
  manifestCreatedAt: Date | null;
  deploymentCount: bigint | number;
  deploymentId: string | null;
  environmentId: string | null;
  environmentRole: string | null;
  environmentName: string | null;
  deploymentStatus: string | null;
  artifactManifestId: string | null;
  deploymentBuildRunId: string | null;
  deploymentOccurredAt: Date | null;
  sourceType: string;
  sourceId: string;
  step: string;
  executionStatus: string;
  lastExecutedAt: Date;
}

export function presentReleaseOrderListRow(
  row: ReleaseOrderListRow,
): ReleaseOrderListItem {
  return {
    id: row.id,
    projectId: row.projectId,
    releaseVersion: row.releaseVersion,
    note: row.note,
    status: status(row.status),
    createdAt: iso(row.createdAt),
    source: {
      branch: row.sourceBranch,
      commitSha: row.sourceCommitSha,
      buildRunId: row.buildRunId,
      buildRevision: row.buildRevision,
      buildStatus: row.buildStatus,
    },
    build: {
      count: count(row.buildCount),
      recentSuccessfulManifest: manifest(row),
    },
    deployment: {
      count: count(row.deploymentCount),
      latest: deployment(row),
    },
    lastExecution: {
      step: row.step as ReleaseOrderListStep,
      sourceType: row.sourceType as ReleaseOrderListSourceType,
      sourceId: row.sourceId,
      status: row.executionStatus,
      occurredAt: iso(row.lastExecutedAt),
    },
    lastExecutedAt: iso(row.lastExecutedAt),
  };
}

function manifest(row: ReleaseOrderListRow) {
  if (
    !row.manifestId ||
    !row.manifestDigest ||
    !row.manifestBuildRunId ||
    row.manifestBuildRevision === null ||
    !row.manifestCreatedAt
  )
    return null;
  return {
    id: row.manifestId,
    digest: row.manifestDigest,
    buildRunId: row.manifestBuildRunId,
    buildRevision: row.manifestBuildRevision,
    createdAt: iso(row.manifestCreatedAt),
  };
}

function deployment(
  row: ReleaseOrderListRow,
): ReleaseOrderListItem["deployment"]["latest"] {
  const environmentRole = row.environmentRole;
  if (
    !row.deploymentId ||
    !row.environmentId ||
    !row.environmentName ||
    !row.deploymentStatus ||
    !row.artifactManifestId ||
    !row.deploymentBuildRunId ||
    !row.deploymentOccurredAt ||
    (environmentRole !== "staging" && environmentRole !== "production")
  )
    return null;
  return {
    id: row.deploymentId,
    environmentId: row.environmentId,
    environmentRole,
    environmentName: row.environmentName,
    status: row.deploymentStatus,
    artifactManifestId: row.artifactManifestId,
    buildRunId: row.deploymentBuildRunId,
    occurredAt: iso(row.deploymentOccurredAt),
  };
}

export function count(value: bigint | number) {
  const normalized = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error("Release order list count exceeds a safe integer");
  }
  return normalized;
}

function iso(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Release order list returned an invalid timestamp");
  }
  return value.toISOString();
}

function status(value: string): ReleaseOrderListStatus {
  if (!RELEASE_ORDER_LIST_STATUSES.includes(value as ReleaseOrderListStatus)) {
    throw new Error(`Unsupported persisted release order status: ${value}`);
  }
  return value as ReleaseOrderListStatus;
}
