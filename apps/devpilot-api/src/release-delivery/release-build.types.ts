export interface ReleaseBuildComponent {
  key: string;
  name: string;
  workingDirectory: string;
  buildCommand: string;
}

export interface ReleaseBuildInputSnapshot {
  version: 1;
  repositoryUrl: string;
  sourceBranch: string;
  sourceCommitSha: string;
  components: ReleaseBuildComponent[];
}

export interface ReleaseBuildExecutionInput {
  buildRunId: string;
  projectId: string;
  releaseOrderId: string;
  checkoutRoot: string;
  components: ReleaseBuildComponent[];
}

export interface ReleaseBuildExecutionResult {
  artifact: {
    digest: string;
    sizeBytes: number;
    uri: string;
  };
  logs: string[];
  gateSummary: Record<string, unknown>;
}

export abstract class ReleaseBuildExecutorPort {
  abstract execute(
    input: ReleaseBuildExecutionInput,
  ): Promise<ReleaseBuildExecutionResult>;
}

export interface ReleaseBuildFailure {
  code: string;
  message: string;
  logs: string[];
  gateSummary: Record<string, unknown>;
}
