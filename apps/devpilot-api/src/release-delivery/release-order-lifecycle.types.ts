export const RELEASE_ORDER_PERSISTED_STATUSES = [
  "draft",
  "active",
  "succeeded",
  "failed",
  "canceled",
] as const;

export const RELEASE_ORDER_LIFECYCLE_STATUSES = [
  "draft",
  "building",
  "staging",
  "awaiting_approval",
  "production",
  "succeeded",
  "failed",
  "withdrawn",
] as const;

export type ReleaseOrderPersistedStatus =
  (typeof RELEASE_ORDER_PERSISTED_STATUSES)[number];
export type ReleaseOrderLifecycleStatus =
  (typeof RELEASE_ORDER_LIFECYCLE_STATUSES)[number];
export type ReleaseOrderLifecyclePhase =
  | "preflight"
  | "build"
  | "staging"
  | "production";
export type ReleaseOrderLifecycleSourceType =
  | "order_created"
  | "build_run"
  | "deployment_run"
  | "release_run"
  | "withdrawal";
export type ReleaseOrderLifecycleFailureKind =
  | "failed"
  | "blocked"
  | "canceled"
  | "evidence_mismatch";

export interface ReleaseOrderLifecycle {
  status: ReleaseOrderLifecycleStatus;
  phase: ReleaseOrderLifecyclePhase;
  sourceType: ReleaseOrderLifecycleSourceType;
  sourceId: string;
  sourceStatus: string;
  occurredAt: string;
  failureKind?: ReleaseOrderLifecycleFailureKind;
}

export interface ReleaseOrderLifecycleRow {
  persistedStatus: string;
  lifecycleStatus: string;
  lifecyclePhase: string;
  lifecycleSourceType: string;
  lifecycleSourceId: string;
  lifecycleSourceStatus: string;
  lifecycleOccurredAt: Date;
  lifecycleFailureKind: string | null;
}
