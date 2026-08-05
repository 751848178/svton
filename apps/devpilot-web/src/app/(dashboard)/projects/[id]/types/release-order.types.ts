import type {
  ReleaseOrderLifecycle,
  ReleaseOrderPersistedStatus,
} from './release-order-lifecycle.types';

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

export type ReleaseOrderStep = 'preflight' | 'build' | 'staging' | 'production';

export interface ReleaseOrderDetail extends Omit<ReleaseOrderItem, 'status'> {
  persistedStatus: ReleaseOrderPersistedStatus;
  lifecycle: ReleaseOrderLifecycle;
  resumeStep: ReleaseOrderStep;
  preflight: {
    ready: boolean;
    repository: {
      ready: boolean;
      branch: string | null;
      identityRevisionId: string | null;
      identityRevision: number | null;
    };
    staging: { ready: boolean };
    production: { ready: boolean };
  };
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
  sourceRepository: null | {
    provider: string;
    canonicalUrl: string;
    identityRevisionId: string;
    identityRevision: number;
    branch: string;
  };
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

export interface ReleaseStagingDeploymentItem {
  id: string;
  projectId: string;
  releaseOrderId: string;
  environmentId: string | null;
  artifactManifestId: string | null;
  status: string;
  targetType: string;
  executorKey: string;
  adapterKey: string;
  dryRun: boolean;
  branch: string | null;
  commitSha: string | null;
  logs: unknown;
  result: unknown;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface ReleaseStagingDeploymentListResponse {
  items: ReleaseStagingDeploymentItem[];
  total: number;
}

export interface ProductionReleaseSnapshot {
  version: 2;
  projectId: string;
  releaseOrder: { id: string; releaseVersion: string };
  environment: { id: string; key: string; name: string; baselineRole: 'production' };
  build: {
    id: string;
    revision: number;
    sourceBranch: string;
    sourceCommitSha: string;
  };
  manifest: { id: string; digest: string };
  stagingProof: { deploymentRunId: string; environmentId: string; finishedAt: string };
  config: {
    revisionId: string;
    revision: number;
    snapshotHash: string;
    resourceSnapshot: unknown;
    routeSnapshot: unknown;
    policySnapshot: unknown;
  };
  releasePolicy: {
    revisionId: string | null;
    revision: number;
    strategy: 'standard';
    requireProductionApproval: true;
    snapshotHash: string;
    synthetic: boolean;
  };
}

export interface ProductionReleasePreview {
  inputHash: string;
  snapshot: ProductionReleaseSnapshot;
}

export interface ProductionReleaseRun {
  id: string;
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  artifactManifestId: string;
  status: string;
  verifiedDigest: string;
  inputHash: string;
  idempotencyKey: string;
  createdAt: string;
  operationApproval: null | {
    id: string;
    status: string;
    inputHash: string | null;
    requestedAt: string;
  };
}

export interface ProductionReleaseListResponse {
  items: ProductionReleaseRun[];
  total: number;
}
