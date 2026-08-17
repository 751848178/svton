import { ConflictException } from "@nestjs/common";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import type { ReleaseBuildResultRepository } from "./release-build-result.repository";
import type { ReleaseBuildExecutorPort } from "./release-build.types";

export async function discardUncommittedBuildArtifact(input: {
  results: ReleaseBuildResultRepository;
  executor: ReleaseBuildExecutorPort;
  projectId: string;
  releaseOrderId: string;
  buildRunId: string;
  digest: string;
  persistenceStarted: boolean;
  error: unknown;
}) {
  const committed = await input.results.hasCommittedArtifact({
    buildRunId: input.buildRunId,
    digest: input.digest,
  }).catch(() => undefined);
  if (committed !== false) return;
  if (
    input.persistenceStarted &&
    !(input.error instanceof ConflictException) &&
    !(input.error instanceof ReleaseBuildExecutionError)
  ) return;
  await input.executor.discardArtifact({
    projectId: input.projectId,
    releaseOrderId: input.releaseOrderId,
    buildRunId: input.buildRunId,
  }).catch(() => undefined);
}
