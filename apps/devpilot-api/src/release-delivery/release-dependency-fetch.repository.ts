import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createDependencyFetchLease, dependencyFetchLeaseTokenHash,
  DEPENDENCY_FETCH_LEASE_MS } from "./release-dependency-lease.policy";
import type { DependencyFetchIdentity } from "./release-dependency-store-contract";

type ReserveInput = DependencyFetchIdentity & { buildRunId: string };

@Injectable()
export class ReleaseDependencyFetchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(input: ReserveInput) {
    const row = await this.prisma.releaseDependencyFetchRun.upsert({
      where: { combinationHash: input.combinationHash },
      create: persistent(input), update: {},
    });
    assertImmutable(row, input);
    const now = new Date();
    const lease = createDependencyFetchLease(now);
    const claimed = await this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: row.id, OR: [
        { status: { in: ["queued", "failed", "invalidated", "succeeded"] } },
        { status: { in: ["fetching", "verifying"] }, leaseExpiresAt: { lt: now } },
      ] },
      data: { status: "fetching", leaseTokenHash: lease.tokenHash,
        leasedAt: now, heartbeatAt: now, leaseExpiresAt: lease.expiresAt,
        errorCode: null, errorMessage: null, finishedAt: null },
    });
    return claimed.count === 1
      ? { role: "owner" as const, row: { ...row, status: "fetching" },
          leaseToken: lease.token }
      : { role: "wait" as const, row };
  }

  get(fetchRunId: string) {
    return this.prisma.releaseDependencyFetchRun.findUnique({ where: { id: fetchRunId } });
  }

  heartbeat(fetchRunId: string, token: string, now = new Date()) {
    return this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: fetchRunId, status: { in: ["fetching", "verifying"] },
        leaseTokenHash: dependencyFetchLeaseTokenHash(token),
        leaseExpiresAt: { gt: now } },
      data: { heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + DEPENDENCY_FETCH_LEASE_MS) },
    });
  }

  async markVerifying(fetchRunId: string, token: string, now = new Date()) {
    const result = await this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: fetchRunId, status: "fetching",
        leaseTokenHash: dependencyFetchLeaseTokenHash(token),
        leaseExpiresAt: { gt: now } },
      data: { status: "verifying", heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + DEPENDENCY_FETCH_LEASE_MS) },
    });
    if (result.count !== 1) throw conflict();
  }

  async succeed(input: { buildRunId: string; fetchRunId: string;
    leaseToken: string; storeDigest: string }, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.releaseDependencyFetchRun.updateMany({
        where: { id: input.fetchRunId, status: "verifying",
          leaseTokenHash: dependencyFetchLeaseTokenHash(input.leaseToken),
          leaseExpiresAt: { gt: now } },
        data: { status: "succeeded", storeDigest: input.storeDigest,
          leaseTokenHash: null, leasedAt: null, heartbeatAt: null,
          leaseExpiresAt: null, finishedAt: now },
      });
      if (claimed.count !== 1) throw conflict();
      const frozen = await tx.buildRun.updateMany({
        where: { id: input.buildRunId, status: "running",
          OR: [{ dependencyFetchRunId: null },
            { dependencyFetchRunId: input.fetchRunId }] },
        data: { dependencyFetchRunId: input.fetchRunId,
          dependencyStoreDigest: input.storeDigest },
      });
      if (frozen.count !== 1) throw conflict();
    });
  }

  finish(input: { fetchRunId: string; leaseToken: string;
    status: "failed" | "blocked" | "unavailable" | "invalidated";
    code: string; message: string }) {
    return this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: input.fetchRunId, status: { in: ["fetching", "verifying"] },
        leaseTokenHash: dependencyFetchLeaseTokenHash(input.leaseToken) },
      data: { status: input.status, errorCode: input.code,
        errorMessage: input.message, leaseTokenHash: null, leasedAt: null,
        heartbeatAt: null, leaseExpiresAt: null, finishedAt: new Date() },
    });
  }
}

function persistent(input: ReserveInput) {
  const { buildRunId: _buildRunId, ...value } = input;
  return value;
}
function assertImmutable(row: Record<string, unknown>, input: ReserveInput) {
  for (const key of ["combinationHash", "lockfileDigest", "profileId",
    "profileVersion", "profileSnapshotHash", "supplyChainDigest", "fetchImage",
    "jobImage", "pnpmVersion", "platformOs", "platformArch", "platformAbi",
    "platformLibc", "registryPolicyDigest"] as const) {
    if (row[key] !== input[key]) throw new ConflictException(
      "依赖预取组合哈希与不可变输入不一致");
  }
}
function conflict() { return new ConflictException("依赖预取状态已被其他执行占用"); }
