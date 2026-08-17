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
    observabilitySnapshot: unknown;
  };
  releasePolicy: {
    revisionId: string | null;
    revision: number;
    strategy: 'standard';
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
  preflight: {
    decision: {
      previewOnly: true;
      checkpoint: 'production_pre_execution';
      allowed: boolean;
      preApprovalAllowed: boolean;
      preApprovalBlockerGateIds: string[];
      preApprovalManualGateIds: string[];
      blockerGateIds: string[];
      manualGateIds: string[];
      integrityErrors: string[];
    };
    checks: Array<{
      id: string;
      status: string;
      reasonCode: string;
      reason: { zh: string; en: string };
      providerKey?: string | null;
      evidenceRef?: string | null;
      checkedAt?: string | null;
      expiresAt?: string | null;
      fresh?: boolean | null;
      repairHref?: string;
      localOnly: boolean;
      deferredUntilApproval: boolean;
    }>;
    acceptanceOnly: boolean;
    readiness: 'technical_acceptance' | 'production_ready' | 'blocked';
    repairHref: string;
    frozen: {
      deploymentInputHash: string;
      workloadInputHash: string;
      workloadServiceCount: number;
      workloadHealthConfigured: boolean;
    };
  };
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
