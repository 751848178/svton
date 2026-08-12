import type {
  ReleaseDeploymentInputSnapshot,
  ReleaseDeploymentTargetConnection,
} from "./release-deployment-input.types";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

export interface StagingArtifactInput {
  deploymentRunId: string;
  stage: "staging" | "production";
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  manifestId: string;
  buildRunId: string;
  uri: string;
  digest: string;
  deploymentInput?: ReleaseDeploymentInputSnapshot;
  globalEnvironment?: Record<string, string>;
  componentEnvironments?: Record<string, Record<string, string>>;
  targetConnection?: ReleaseDeploymentTargetConnection;
  workload?: ReleaseStagingWorkloadSnapshot;
}

export interface StagingArtifactResult {
  deploymentUri: string;
  logs: string[];
  evidence: Record<string, unknown>;
}

export abstract class ReleaseStagingExecutorPort {
  abstract readonly providerKey: string;
  abstract readonly providerTargetRef: string;
  abstract deploy(input: StagingArtifactInput): Promise<StagingArtifactResult>;
  abstract refreshPromotionEvidence(input: {
    projectId: string; environmentId: string; deploymentRunId: string;
    workload: ReleaseStagingWorkloadSnapshot;
  }): Promise<Record<string, unknown> | undefined>;
}

export class ReleaseStagingExecutionError extends Error {
  constructor(
    readonly detail: {
      code: string;
      message: string;
      logs: string[];
    },
  ) {
    super(detail.message);
    this.name = "ReleaseStagingExecutionError";
  }
}
