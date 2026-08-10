import type { Prisma } from "@prisma/client";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";

export async function assertReproducibleArtifact(
  tx: Prisma.TransactionClient,
  input: {
    projectId: string;
    buildRunId: string;
    inputHash: string;
    digest: string;
  },
) {
  const prior = await tx.artifactManifest.findFirst({
    where: {
      projectId: input.projectId,
      buildRunId: { not: input.buildRunId },
      buildRun: { inputHash: input.inputHash },
    },
    select: { id: true, digest: true, buildRunId: true },
  });
  if (prior && prior.digest !== input.digest) {
    throw new ReleaseBuildExecutionError({
      code: "ARTIFACT_REPRODUCIBILITY_MISMATCH",
      message: "相同构建输入产生了不同制品 Digest",
      logs: [
        `prior manifest ${prior.id} build ${prior.buildRunId} digest ${prior.digest}`,
      ],
      gateSummary: {
        artifact: { status: "failed", reproducible: false },
        action: "检查非确定性构建输入后创建新的 BuildRun。",
      },
    });
  }
  return prior;
}
