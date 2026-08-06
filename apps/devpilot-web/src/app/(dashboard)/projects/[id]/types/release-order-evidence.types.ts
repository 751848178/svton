import type {
  ReleaseApprovalStatus,
  ReleaseEnvironmentRole,
  ReleaseExecutionStatus,
} from './release-copy.types';

export interface ReleaseEvidenceManifest {
  id: string;
  digest: string;
  createdAt: string;
  buildRun: {
    id: string;
    revision: number;
    sourceBranch: string;
    sourceCommitSha: string;
  };
  items: Array<{ componentKey: string; artifactType: string; digest: string }>;
}

export interface ReleaseEvidenceBuildRun {
  id: string;
  projectId: string;
  releaseOrderId: string;
  revision: number;
  sourceBranch: string;
  sourceCommitSha: string;
  status: ReleaseExecutionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  manifest: ReleaseEvidenceManifest | null;
}

export interface ReleaseEvidenceDeploymentRun {
  id: string;
  projectId: string;
  releaseOrderId: string;
  releaseRunId: string | null;
  environmentId: string | null;
  artifactManifestId: string | null;
  status: ReleaseExecutionStatus;
  executorKey: string;
  adapterKey: string;
  branch: string | null;
  commitSha: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  environment: { id: string; name: string; baselineRole: ReleaseEnvironmentRole | null };
  manifest: ReleaseEvidenceManifest;
}

export interface ReleaseEvidenceProductionRun {
  id: string;
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  artifactManifestId: string;
  status: ReleaseExecutionStatus;
  verifiedDigest: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  environment: { id: string; name: string; baselineRole: ReleaseEnvironmentRole | null };
  manifest: ReleaseEvidenceManifest;
  operationApproval: {
    id: string;
    status: ReleaseApprovalStatus;
    risk: string;
    summary: string | null;
    requesterId: string | null;
    reviewerId: string | null;
    requester: { id: string; name: string | null; email: string } | null;
    reviewer: { id: string; name: string | null; email: string } | null;
    reviewComment: string | null;
    requestedAt: string;
    reviewedAt: string | null;
    consumedAt: string | null;
    expiresAt: string | null;
  };
  stagingProof: {
    deploymentRunId: string;
    environmentId: string;
    finishedAt: string | null;
  } | null;
  deploymentRuns: ReleaseEvidenceDeploymentRun[];
}

interface EvidenceGroup<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface ReleaseOrderEvidence {
  projectId: string;
  releaseOrderId: string;
  buildRuns: EvidenceGroup<ReleaseEvidenceBuildRun>;
  stagingDeploymentRuns: EvidenceGroup<ReleaseEvidenceDeploymentRun>;
  productionReleaseRuns: EvidenceGroup<ReleaseEvidenceProductionRun>;
}
