export const RELEASE_ORDER_LIST_STATUSES = [
  "draft",
  "active",
  "succeeded",
  "failed",
  "canceled",
] as const;

export type ReleaseOrderListStatus =
  (typeof RELEASE_ORDER_LIST_STATUSES)[number];
export type ReleaseOrderListStep =
  | "preflight"
  | "build"
  | "staging"
  | "production";
export type ReleaseOrderListSourceType =
  | "order_created"
  | "build_run"
  | "deployment_run"
  | "release_run";

export interface ReleaseOrderListQueryInput {
  teamId: string;
  projectId: string;
  query?: string;
  status?: ReleaseOrderListStatus;
  take: number;
}

export interface ReleaseOrderListItem {
  id: string;
  projectId: string;
  releaseVersion: string;
  note: string | null;
  status: ReleaseOrderListStatus;
  createdAt: string;
  source: {
    branch: string | null;
    commitSha: string | null;
    buildRunId: string | null;
    buildRevision: number | null;
    buildStatus: string | null;
  };
  build: {
    count: number;
    recentSuccessfulManifest: null | {
      id: string;
      digest: string;
      buildRunId: string;
      buildRevision: number;
      createdAt: string;
    };
  };
  deployment: {
    count: number;
    latest: null | {
      id: string;
      environmentId: string;
      environmentRole: "staging" | "production";
      environmentName: string;
      status: string;
      artifactManifestId: string;
      buildRunId: string;
      occurredAt: string;
    };
  };
  lastExecution: {
    step: ReleaseOrderListStep;
    sourceType: ReleaseOrderListSourceType;
    sourceId: string;
    status: string;
    occurredAt: string;
  };
  lastExecutedAt: string;
}

export interface ReleaseOrderListResult {
  items: ReleaseOrderListItem[];
  total: number;
}
