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
