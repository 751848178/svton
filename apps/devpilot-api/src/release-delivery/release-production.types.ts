export interface ProductionReleaseSnapshot {
  version: 2;
  projectId: string;
  releaseOrder: { id: string; releaseVersion: string };
  environment: {
    id: string;
    key: string;
    name: string;
    baselineRole: "production";
  };
  build: {
    id: string;
    revision: number;
    sourceBranch: string;
    sourceCommitSha: string;
  };
  manifest: { id: string; digest: string };
  stagingProof: {
    deploymentRunId: string;
    environmentId: string;
    finishedAt: string;
  };
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
    strategy: "standard";
    requireProductionApproval: true;
    snapshotHash: string;
    synthetic: boolean;
  };
}

export interface ProductionReleasePreview {
  inputHash: string;
  snapshot: ProductionReleaseSnapshot;
}
