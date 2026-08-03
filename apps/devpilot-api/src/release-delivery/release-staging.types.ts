export interface StagingArtifactInput {
  deploymentRunId: string;
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  buildRunId: string;
  uri: string;
  digest: string;
}

export interface StagingArtifactResult {
  deploymentUri: string;
  logs: string[];
  evidence: Record<string, unknown>;
}

export abstract class ReleaseStagingExecutorPort {
  abstract deploy(input: StagingArtifactInput): Promise<StagingArtifactResult>;
}

export class ReleaseStagingExecutionError extends Error {
  constructor(readonly detail: {
    code: string;
    message: string;
    logs: string[];
  }) {
    super(detail.message);
    this.name = "ReleaseStagingExecutionError";
  }
}
