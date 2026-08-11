import { ConflictException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

type ReserveInput = {
  buildRunId: string; fetchRunId: string; combinationHash: string;
  lockfileDigest: string; profileId: string; profileVersion: number;
  pnpmVersion: string; platformOs: string; platformArch: string;
  registryPolicyDigest: string;
};

@Injectable()
export class ReleaseDependencyFetchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(input: ReserveInput) {
    const row = await this.prisma.releaseDependencyFetchRun.upsert({
      where: { combinationHash: input.combinationHash },
      create: { id: input.fetchRunId, combinationHash: input.combinationHash,
        lockfileDigest: input.lockfileDigest, profileId: input.profileId,
        profileVersion: input.profileVersion, pnpmVersion: input.pnpmVersion,
        platformOs: input.platformOs, platformArch: input.platformArch,
        registryPolicyDigest: input.registryPolicyDigest },
      update: {},
    });
    assertImmutable(row, input);
    const linked = await this.prisma.buildRun.updateMany({
      where: { id: input.buildRunId, status: "running",
        OR: [{ dependencyFetchRunId: null }, { dependencyFetchRunId: row.id }] },
      data: { dependencyFetchRunId: row.id },
    });
    if (linked.count !== 1) throw conflict();
    if (row.status === "succeeded" && row.storeDigest)
      return { role: "reuse" as const, row };
    const stale = new Date(Date.now() - 10 * 60_000);
    const leaseToken = randomUUID();
    const claimed = await this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: row.id, OR: [
        { status: { in: ["queued", "failed"] } },
        { status: "fetching", leasedAt: { lt: stale } },
      ] },
      data: { status: "fetching", leaseToken, leasedAt: new Date(),
        errorCode: null, errorMessage: null, finishedAt: null },
    });
    return claimed.count === 1
      ? { role: "owner" as const, row: { ...row, status: "fetching", leaseToken } }
      : { role: "wait" as const, row };
  }

  get(fetchRunId: string) {
    return this.prisma.releaseDependencyFetchRun.findUnique({
      where: { id: fetchRunId },
    });
  }

  async markVerifying(fetchRunId: string, leaseToken: string) {
    const result = await this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: fetchRunId, status: "fetching", leaseToken },
      data: { status: "verifying" },
    });
    if (result.count !== 1) throw conflict();
  }

  async succeed(input: { buildRunId: string; fetchRunId: string;
    leaseToken: string; storeDigest: string }) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.releaseDependencyFetchRun.updateMany({
        where: { id: input.fetchRunId, status: "verifying",
          leaseToken: input.leaseToken },
        data: { status: "succeeded", storeDigest: input.storeDigest,
          leaseToken: null, leasedAt: null, finishedAt: new Date() },
      });
      if (claimed.count !== 1) throw conflict();
      const frozen = await tx.buildRun.updateMany({
        where: { id: input.buildRunId, status: "running",
          dependencyFetchRunId: input.fetchRunId },
        data: { dependencyStoreDigest: input.storeDigest },
      });
      if (frozen.count !== 1) throw conflict();
    });
  }

  fail(input: { fetchRunId: string; leaseToken: string;
    status: "failed" | "blocked" | "unavailable"; code: string; message: string }) {
    return this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: input.fetchRunId, status: { in: ["fetching", "verifying"] },
        leaseToken: input.leaseToken },
      data: { status: input.status, errorCode: input.code,
        errorMessage: input.message, leaseToken: null, leasedAt: null,
        finishedAt: new Date() },
    });
  }
}

function assertImmutable(
  row: Omit<ReserveInput, "buildRunId" | "fetchRunId">,
  input: ReserveInput,
) {
  for (const key of ["combinationHash", "lockfileDigest", "profileId",
    "profileVersion", "pnpmVersion", "platformOs", "platformArch",
    "registryPolicyDigest"] as const) {
    if (row[key] !== input[key]) throw new ConflictException(
      "依赖预取组合哈希与不可变输入不一致",
    );
  }
}
function conflict() { return new ConflictException("依赖预取状态已被其他执行占用"); }
