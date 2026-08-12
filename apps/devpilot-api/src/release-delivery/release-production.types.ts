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
    observabilitySnapshot: unknown;
  };
  releasePolicy: {
    revisionId: string | null;
    revision: number;
    strategy: "standard";
    requireProductionApproval: true;
    snapshotHash: string;
    synthetic: boolean;
  };
  workload: {
    inputHash: string;
    services: Array<{
      serviceId: string;
      componentKey: string;
      stateHash: string;
    }>;
  };
}

export interface ProductionReleasePreview {
  inputHash: string;
  snapshot: ProductionReleaseSnapshot;
  preflight?: {
    decision: import("./release-gate-decision.types").ReleaseGatePreviewDecision;
    checks: import("./release-gate-catalog.types").ReleaseGateEvaluation[];
    acceptanceOnly: boolean;
    readiness: "technical_acceptance" | "production_ready" | "blocked";
    repairHref: string;
    frozen: {
      deploymentInputHash: string;
      workloadInputHash: string;
      workloadServiceCount: number;
      workloadHealthConfigured: boolean;
    };
  };
}
