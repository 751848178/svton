import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

export async function assertBuildDependencyStoreSucceeded(
  tx: Prisma.TransactionClient,
  buildRunId: string,
) {
  const run = await tx.buildRun.findUnique({
    where: { id: buildRunId },
    select: { dependencyFetchRunId: true, dependencyStoreDigest: true,
      dependencyFetchRun: { select: { status: true, storeDigest: true } } },
  });
  if (!run?.dependencyFetchRunId || !run.dependencyStoreDigest ||
    run.dependencyFetchRun?.status !== "succeeded" ||
    run.dependencyFetchRun.storeDigest !== run.dependencyStoreDigest) {
    throw new ConflictException(
      "BuildRun 的依赖存储尚未完成可信冻结，不能提交制品",
    );
  }
}
