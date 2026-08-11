export interface ReleaseBuildComponent {
  key: string;
  name: string;
  workingDirectory: string;
  buildCommand: string;
  artifactOutputs: string[];
  buildEnvironment: Record<string, string>;
}

export interface ReleaseBuildArtifactItem {
  componentKey: string;
  artifactType: "zip";
  digest: string;
  uri: string;
  sizeBytes: number;
  outputs: string[];
  contentIndex: Array<{ path: string; digest: string; sizeBytes: number }>;
  environment: {
    mode: "independent" | "baked";
    fingerprint?: string;
  };
}

export interface ReleaseBuildRuntimeDescriptor {
  profile: "controlled-local-v1";
  runTimeoutMs: number;
  commandTimeoutMs: number;
  cancelGraceMs: number;
  maxConcurrency: number;
  concurrencyScope: "single-process";
  workspacePolicy: "dedicated-build-root";
  environmentKeys: readonly string[];
}

interface ReleaseBuildInputSnapshotBase {
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

export interface ReleaseBuildInputSnapshotV2 extends ReleaseBuildInputSnapshotBase {
  version: 2;
}

export interface ReleaseBuildInputSnapshotV3 extends ReleaseBuildInputSnapshotBase {
  version: 3;
  runtime: ReleaseBuildRuntimeDescriptor;
}

export interface ReleaseBuildInputSnapshotV4 extends ReleaseBuildInputSnapshotBase {
  version: 4;
  runtime: ReleaseBuildRuntimeDescriptor;
  artifactContract: {
    version: 1;
    collection: "declared-outputs-only";
    environment: "explicit-public-build-values";
  };
}

export type ReleaseBuildInputSnapshot =
  | ReleaseBuildInputSnapshotV2
  | ReleaseBuildInputSnapshotV3
  | ReleaseBuildInputSnapshotV4;

export interface ReleaseBuildResolvedSource {
  context: {
    project: {
      applications: Array<{
        id: string;
        name: string;
        repoPath: string | null;
        services: Array<{
          id: string;
          releaseComponentKey: string | null;
          name: string;
          deployConfig: unknown;
        }>;
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
    items: ReleaseBuildArtifactItem[];
    contentIndex: Array<{ path: string; digest: string; sizeBytes: number }>;
  };
  logs: string[];
  gateSummary: Record<string, unknown>;
}

export abstract class ReleaseBuildExecutorPort {
  abstract execute(
    input: ReleaseBuildExecutionInput,
    signal?: AbortSignal,
  ): Promise<ReleaseBuildExecutionResult>;

  abstract discardArtifact(input: {
    projectId: string;
    releaseOrderId: string;
    buildRunId: string;
  }): Promise<void>;
}

export interface ReleaseBuildFailure {
  code: string;
  message: string;
  logs: string[];
  gateSummary: Record<string, unknown>;
  status?: "failed" | "canceled";
}
