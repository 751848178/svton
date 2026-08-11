export type ReleaseGatePromoteEvidence = {
  environment: {
    id: string;
    currentConfigRevision: {
      id: string;
      routeSnapshot: unknown;
      createdAt: Date;
    } | null;
    currentEnvironmentVersion: {
      id: string;
      artifactManifestId: string;
      deploymentRunId: string;
      releaseRunId: string | null;
      effectiveAt: Date;
    } | null;
    environmentVersions: Array<{
      id: string;
      artifactManifestId: string;
      deploymentRunId: string;
      previousVersionId: string | null;
      effectiveAt: Date;
      artifactManifest: {
        id: string;
        digest: string;
        items: Array<{ id: string; digest: string }>;
      };
      deploymentRun: {
        id: string;
        status: string;
        dryRun: boolean;
      };
    }>;
  } | null;
  releaseRun: {
    id: string;
    environmentId: string;
    artifactManifestId: string;
    mode: string;
    status: string;
    inputHash: string;
    policySnapshot: unknown;
    routeSnapshot: unknown;
    finishedAt: Date | null;
    createdAt: Date;
    operationApproval: {
      id: string;
      projectId: string | null;
      environmentId: string | null;
      status: string;
      inputHash: string | null;
      reviewedAt: Date | null;
      consumedAt: Date | null;
      expiresAt: Date | null;
    } | null;
    deploymentRuns: Array<{
      id: string;
      environmentId: string | null;
      status: string;
      dryRun: boolean;
      artifactManifestId: string | null;
      healthCheckUrl: string | null;
      result: unknown;
      finishedAt: Date | null;
      createdAt: Date;
    }>;
  } | null;
  sites: Array<{
    id: string;
    environmentId: string | null;
    status: string;
    primaryDomain: string;
    aliases: unknown;
    tls: unknown;
    dns: unknown;
    lastSyncAt: Date | null;
    updatedAt: Date;
  }>;
  alerts: Array<{
    id: string;
    environmentId: string | null;
    metric: string;
    severity: string;
    status: string;
    value: unknown;
    metadata: unknown;
    occurredAt: Date;
  }>;
  logRuns: Array<{
    id: string;
    environmentId: string | null;
    status: string;
    dryRun: boolean;
    result: unknown;
    ingestedEntryCount: number;
    finishedAt: Date | null;
    createdAt: Date;
  }>;
  metrics: Array<{
    id: string;
    environmentId: string | null;
    status: string;
    sampledAt: Date;
    raw: unknown;
  }>;
  routeSwitchRuns: Array<{
    id: string;
    operationId: string;
    releaseRunId: string | null;
    deploymentRunId: string | null;
    targetRef: string | null;
    status: string;
    result: unknown;
    applyReceipt: unknown;
    updatedAt: Date;
  }>;
};
