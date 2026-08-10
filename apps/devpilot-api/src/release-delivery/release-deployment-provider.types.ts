import type { ReleaseDeploymentTargetConnection } from "./release-deployment-input.types";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

export type ReleaseDeploymentStage = "staging" | "production";

export interface ExactManifestDeploymentInput {
  deploymentRunId: string;
  stage: ReleaseDeploymentStage;
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  targetRef: string;
  manifest: {
    id: string;
    buildRunId: string;
    uri: string;
    digest: string;
  };
  artifact: { path: string; sizeBytes: number };
  runtimeEnvironment?: Record<string, string>;
  targetConnection?: ReleaseDeploymentTargetConnection;
  workload?: ReleaseStagingWorkloadSnapshot;
}

export interface ExactManifestDeploymentReceipt {
  providerKey: string;
  providerDeploymentId: string;
  targetRef: string;
  deploymentUri: string;
  manifestId: string;
  manifestDigest: string;
  activatedAt: string;
  logs: string[];
  evidence: Record<string, unknown>;
}

export abstract class ReleaseDeploymentProviderPort {
  abstract readonly key: string;
  abstract readonly targetRef: string;
  abstract deployExactManifest(
    input: ExactManifestDeploymentInput,
  ): Promise<ExactManifestDeploymentReceipt>;
}

export class ReleaseDeploymentProviderError extends Error {
  constructor(
    readonly detail: {
      code: string;
      message: string;
      logs: string[];
      workloadCleanupAttempted?: boolean;
    },
  ) {
    super(detail.message);
    this.name = "ReleaseDeploymentProviderError";
  }
}

export function releaseWorkloadCleanupWasAttempted(error: unknown) {
  return (
    error instanceof ReleaseDeploymentProviderError &&
    error.detail.workloadCleanupAttempted === true
  );
}
