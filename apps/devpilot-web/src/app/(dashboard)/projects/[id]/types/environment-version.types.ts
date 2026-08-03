export interface EnvironmentVersionItem {
  id: string;
  environmentId: string;
  artifactManifestId: string;
  previousVersionId: string | null;
  kind: 'deploy' | 'upgrade' | 'recovery';
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
  baselineRole: 'staging' | 'production';
  currentEnvironmentVersionId: string | null;
  environmentVersions: EnvironmentVersionItem[];
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
      status: string;
      consumedAt: string | null;
    };
  }>;
}

export interface EnvironmentVersionsResponse {
  environments: EnvironmentVersionEnvironment[];
  candidates: EnvironmentVersionCandidate[];
}

export interface EnvironmentVersionActionResult {
  run: { id: string; status: string; artifactManifestId: string };
  version: EnvironmentVersionItem | null;
}
