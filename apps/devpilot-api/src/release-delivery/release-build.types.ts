export interface ReleaseBuildComponent {
  key: string;
  name: string;
  workingDirectory: string;
  buildCommand: string;
}

export interface ReleaseBuildInputSnapshot {
  version: 2;
  repositoryUrl: string;
  repositoryIdentity: {
    id: string;
    revisionId: string;
    revision: number;
    provider: string;
    canonicalUrl: string;
  };
  sourceBranch: string;
  sourceCommitSha: string;
  components: ReleaseBuildComponent[];
  gateDecision?: import("./release-gate-decision.types").ReleaseGateDecisionReference;
}

export interface ReleaseBuildResolvedSource {
  context: {
    project: {
      applications: Array<{
        id: string;
        name: string;
        repoPath: string | null;
        services: Array<{ id: string; name: string; deployConfig: unknown }>;
      }>;
    };
  };
  connection: import("@prisma/client").RepositoryConnection;
  credential: import("../repository-analysis/repository-analysis.types").RepositoryCredentialMaterial;
  identity: {
    id: string;
    revisionId: string;
    revision: number;
    provider: string;
    canonicalKey: string;
    canonicalUrl: string;
    branch: string;
  };
  commitSha: string;
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
