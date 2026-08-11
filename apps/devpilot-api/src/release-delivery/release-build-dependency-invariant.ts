import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

export async function assertBuildDependencyStoreSucceeded(
  tx: Prisma.TransactionClient,
  buildRunId: string,
  gateSummary: Record<string, unknown>,
) {
  const run = await tx.buildRun.findUnique({ where: { id: buildRunId },
    select: { dependencyFetchRunId: true, dependencyStoreDigest: true,
      dependencyStoreGeneration: true } });
  const evidence = record(gateSummary.dependencyStore);
  if (!run?.dependencyFetchRunId || !run.dependencyStoreDigest ||
    evidence?.status !== "passed" ||
    evidence.fetchRunId !== run.dependencyFetchRunId ||
    evidence.cacheGeneration !== run.dependencyStoreGeneration ||
    evidence.storeDigest !== run.dependencyStoreDigest) {
    throw new ConflictException(
      "BuildRun 的依赖存储尚未完成可信冻结，不能提交制品");
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
