import type { Prisma } from "@prisma/client";
import type { ReleaseBuildArtifactItem } from "./release-build.types";

export type ReleaseBuildManifestInput = {
  teamId: string;
  projectId: string;
  releaseOrderId: string;
  buildRunId: string;
  digest: string;
  uri: string;
  sizeBytes: number;
  items: ReleaseBuildArtifactItem[];
  contentIndex: Array<{ path: string; digest: string; sizeBytes: number }>;
  sourceBranch: string;
  sourceCommitSha: string;
  inputHash: string;
  repositoryIdentityId: string;
  repositoryIdentityRevisionId: string;
  repositoryProvider: string;
  canonicalRepositoryUrl: string;
};

export function createReleaseBuildManifest(
  tx: Prisma.TransactionClient,
  input: ReleaseBuildManifestInput,
  priorManifestId: string | null,
) {
  return tx.artifactManifest.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      buildRunId: input.buildRunId,
      digest: input.digest,
      provenance: {
        source: "release_build",
        immutable: true,
        sourceBranch: input.sourceBranch,
        sourceCommitSha: input.sourceCommitSha,
        repositoryIdentityId: input.repositoryIdentityId,
        repositoryIdentityRevisionId: input.repositoryIdentityRevisionId,
        repositoryProvider: input.repositoryProvider,
        canonicalRepositoryUrl: input.canonicalRepositoryUrl,
        inputHash: input.inputHash,
        artifactContractVersion: 1,
        collection: "declared-outputs-only",
        reproducibility: priorManifestId
          ? { status: "matched", priorManifestId }
          : { status: "baseline" },
        contentIndex: input.contentIndex,
        componentEnvironments: input.items.map((item) => ({
          componentKey: item.componentKey,
          ...item.environment,
        })),
      },
      items: {
        create: [projectBundle(input), ...input.items.map((item) => component(input, item))],
      },
    },
  });
}

function projectBundle(input: ReleaseBuildManifestInput) {
  return {
    componentKey: "project-bundle",
    artifactType: "zip",
    uri: input.uri,
    digest: input.digest,
    metadata: {
      sizeBytes: input.sizeBytes,
      contentIndex: input.contentIndex,
      provenance: { sourceCommitSha: input.sourceCommitSha, inputHash: input.inputHash },
    },
  };
}

function component(input: ReleaseBuildManifestInput, item: ReleaseBuildArtifactItem) {
  return {
    componentKey: item.componentKey,
    artifactType: item.artifactType,
    uri: item.uri,
    digest: item.digest,
    metadata: {
      sizeBytes: item.sizeBytes,
      outputs: item.outputs,
      contentIndex: item.contentIndex,
      environment: item.environment,
      provenance: { sourceCommitSha: input.sourceCommitSha, inputHash: input.inputHash },
    },
  };
}
