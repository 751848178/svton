export interface ReleaseOrderItem {
  id: string;
  projectId: string;
  releaseVersion: string;
  note: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  counts: {
    buildRuns: number;
    manifests: number;
    releaseRuns: number;
  };
}

export interface ReleaseOrderListResponse {
  items: ReleaseOrderItem[];
  total: number;
}

export interface CreateReleaseOrderInput {
  releaseVersion: string;
  note?: string;
}

export interface ReleaseBuildItem {
  id: string;
  releaseOrderId: string;
  revision: number;
  sourceBranch: string;
  sourceCommitSha: string;
  status: string;
  logReference: string | null;
  logSummary: unknown;
  gateSummary: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  manifest: null | {
    id: string;
    digest: string;
    items: Array<{
      componentKey: string;
      artifactType: string;
      uri: string;
      digest: string;
      metadata: unknown;
    }>;
  };
}

export interface ReleaseBuildListResponse {
  items: ReleaseBuildItem[];
  total: number;
}
