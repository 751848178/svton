import {
  RELEASE_ORDER_LIFECYCLE_STATUSES,
  RELEASE_ORDER_PERSISTED_STATUSES,
  type ReleaseOrderLifecycle,
  type ReleaseOrderLifecycleFailureKind,
  type ReleaseOrderLifecyclePhase,
  type ReleaseOrderLifecycleRow,
  type ReleaseOrderLifecycleSourceType,
  type ReleaseOrderLifecycleStatus,
  type ReleaseOrderPersistedStatus,
} from "./release-order-lifecycle.types";

const PHASES = ["preflight", "build", "staging", "production"] as const;
const SOURCE_TYPES = [
  "order_created",
  "build_run",
  "deployment_run",
  "release_run",
  "withdrawal",
] as const;
const FAILURE_KINDS = [
  "failed",
  "blocked",
  "canceled",
  "evidence_mismatch",
] as const;

export function presentReleaseOrderLifecycle(row: ReleaseOrderLifecycleRow): {
  persistedStatus: ReleaseOrderPersistedStatus;
  lifecycle: ReleaseOrderLifecycle;
} {
  return {
    persistedStatus: member(
      RELEASE_ORDER_PERSISTED_STATUSES,
      row.persistedStatus,
      "persisted status",
    ),
    lifecycle: lifecycle(row),
  };
}

function lifecycle(row: ReleaseOrderLifecycleRow): ReleaseOrderLifecycle {
  const value: ReleaseOrderLifecycle = {
    status: member(
      RELEASE_ORDER_LIFECYCLE_STATUSES,
      row.lifecycleStatus,
      "lifecycle status",
    ),
    phase: member(PHASES, row.lifecyclePhase, "lifecycle phase"),
    sourceType: member(
      SOURCE_TYPES,
      row.lifecycleSourceType,
      "lifecycle source",
    ),
    sourceId: row.lifecycleSourceId,
    sourceStatus: row.lifecycleSourceStatus,
    occurredAt: timestamp(row.lifecycleOccurredAt),
  };
  if (row.lifecycleFailureKind !== null) {
    value.failureKind = member(
      FAILURE_KINDS,
      row.lifecycleFailureKind,
      "failure kind",
    );
  }
  return value;
}

function member<const T extends readonly string[]>(
  values: T,
  value: string,
  field: string,
) {
  if (!values.includes(value)) {
    throw new Error(`Unsupported release order ${field}: ${value}`);
  }
  return value as T[number];
}

function timestamp(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Release order lifecycle returned an invalid timestamp");
  }
  return value.toISOString();
}

export type {
  ReleaseOrderLifecycleFailureKind,
  ReleaseOrderLifecyclePhase,
  ReleaseOrderLifecycleSourceType,
  ReleaseOrderLifecycleStatus,
};
