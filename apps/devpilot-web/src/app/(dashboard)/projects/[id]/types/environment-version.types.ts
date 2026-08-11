import type {
  EnvironmentVersionKind,
  ReleaseApprovalStatus,
  ReleaseEnvironmentRole,
} from './release-copy.types';
import type { ReleaseDeploymentTargetReadiness } from './release-gate.types';

export interface EnvironmentVersionItem {
  id: string;
  environmentId: string;
  artifactManifestId: string;
  previousVersionId: string | null;
  kind: EnvironmentVersionKind;
  effectiveAt: string;
  releaseOrder: { id: string; releaseVersion: string };
  artifactManifest: {
    id: string;
    digest: string;
    buildRun: { id: string; revision: number; sourceCommitSha: string };
  };
  deploymentRun: {
    id: string;
    status: string;
    createdAt: string;
    finishedAt: string | null;
  };
}

export interface EnvironmentVersionEnvironment {
  id: string;
  key: string;
  name: string;
  baselineRole: ReleaseEnvironmentRole;
  currentEnvironmentVersionId: string | null;
  targetReadiness: ReleaseDeploymentTargetReadiness;
  environmentVersions: EnvironmentVersionItem[];
  releaseRuns?: Array<{
    id: string;
    mode: string;
    status: string;
    artifactManifestId: string;
    deploymentRuns: Array<{
      id: string;
      status: string;
      result: unknown;
      createdAt: string;
    }>;
  }>;
}

export interface EnvironmentVersionCandidate {
  id: string;
  digest: string;
  releaseOrder: { id: string; releaseVersion: string };
  buildRun: { id: string; revision: number; sourceCommitSha: string };
  deploymentRuns: Array<{ id: string }>;
  releaseRuns: Array<{
    id: string;
    operationApproval: null | {
      id: string;
      status: ReleaseApprovalStatus;
      consumedAt: string | null;
    };
  }>;
}

export interface EnvironmentVersionCandidates {
  staging: EnvironmentVersionCandidate[];
  production: EnvironmentVersionCandidate[];
}

export interface EnvironmentVersionsResponse {
  environments: EnvironmentVersionEnvironment[];
  candidates: EnvironmentVersionCandidates;
}

export interface EnvironmentVersionActionResult {
  run: { id: string; status: string; artifactManifestId: string };
  version: EnvironmentVersionItem | null;
}

export interface ProductionPromotionResumeInput {
  releaseRunId: string;
  deploymentRunId: string;
  candidateHash: string;
}

export interface EnvironmentVersionRecoveryPreview {
  inputHash: string;
  sourceVersionId: string;
  sourceReleaseRunId: string | null;
  sourceVersionKind: string;
  snapshot: {
    releaseOrder: { id: string; releaseVersion: string };
    environment: { id: string; key: string; name: string; baselineRole: 'production' };
    build: { id: string; revision: number; sourceBranch: string; sourceCommitSha: string };
    manifest: { id: string; digest: string };
    config: { revisionId: string; revision: number; snapshotHash: string };
    releasePolicy: { revisionId: string | null; revision: number; synthetic: boolean };
  };
}

export interface EnvironmentVersionRecoveryConfirmInput {
  sourceVersionId: string;
  expectedInputHash: string;
  idempotencyKey: string;
}

export interface EnvironmentVersionRecoveryReleaseRun {
  id: string;
  mode: string;
  status: string;
  sourceReleaseRunId: string | null;
  inputHash: string;
  releaseOrderId: string;
  environmentId: string;
  artifactManifestId: string;
  operationApproval: {
    id: string;
    status: string;
    inputHash: string;
    requestedAt: string;
  };
}
