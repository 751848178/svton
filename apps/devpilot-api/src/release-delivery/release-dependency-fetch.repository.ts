import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createDependencyFetchLease, dependencyFetchLeaseTokenHash,
  DEPENDENCY_FETCH_LEASE_MS } from "./release-dependency-lease.policy";
import type { DependencyFetchIdentity } from "./release-dependency-store-contract";

type ReserveInput = Omit<DependencyFetchIdentity, "cacheGeneration"> & {
  buildRunId: string };

@Injectable()
export class ReleaseDependencyFetchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(input: ReserveInput) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.releaseDependencyFetchRun.upsert({
        where: { combinationHash: input.combinationHash },
        create: { id: input.fetchRunId, ...persistentIdentity(input) }, update: {},
      });
      assertImmutable(row, input);
      if (row.status === "succeeded" && row.storeDigest)
        return { role: "reuse" as const, row };
      if (row.status === "blocked") return { role: "blocked" as const, row };
      const now = new Date();
      const lease = createDependencyFetchLease(now);
      const claimed = await tx.releaseDependencyFetchRun.updateMany({
        where: { id: row.id, cacheGeneration: row.cacheGeneration, OR: [
          { status: { in: ["queued", "failed", "unavailable", "invalidated"] } },
          { status: { in: ["fetching", "verifying"] }, leaseExpiresAt: { lt: now } },
        ] },
        data: { status: "fetching", cacheGeneration: { increment: 1 },
          leaseTokenHash: lease.tokenHash, leasedAt: now, heartbeatAt: now,
          leaseExpiresAt: lease.expiresAt, errorCode: null, errorMessage: null,
          finishedAt: null },
      });
      return claimed.count === 1
        ? { role: "owner" as const, row: { ...row, status: "fetching",
            cacheGeneration: row.cacheGeneration + 1 }, leaseToken: lease.token }
        : { role: "wait" as const, row };
    });
  }

  heartbeat(fetchRunId: string, generation: number, token: string, now = new Date()) {
    return this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: fetchRunId, cacheGeneration: generation,
        status: { in: ["fetching", "verifying"] },
        leaseTokenHash: dependencyFetchLeaseTokenHash(token),
        leaseExpiresAt: { gt: now } },
      data: { heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + DEPENDENCY_FETCH_LEASE_MS) },
    });
  }

  async markVerifying(fetchRunId: string, generation: number, token: string,
    now = new Date()) {
    const result = await this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: fetchRunId, cacheGeneration: generation, status: "fetching",
        leaseTokenHash: dependencyFetchLeaseTokenHash(token),
        leaseExpiresAt: { gt: now } },
      data: { status: "verifying", heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + DEPENDENCY_FETCH_LEASE_MS) },
    });
    if (result.count !== 1) throw conflict();
  }

  async succeed(input: { buildRunId: string; fetchRunId: string;
    cacheGeneration: number; leaseToken: string; storeDigest: string },
    now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.releaseDependencyFetchRun.updateMany({
        where: { id: input.fetchRunId,
          cacheGeneration: input.cacheGeneration, status: "verifying",
          leaseTokenHash: dependencyFetchLeaseTokenHash(input.leaseToken),
          leaseExpiresAt: { gt: now },
          OR: [{ storeDigest: null }, { storeDigest: input.storeDigest }] },
        data: { status: "succeeded", storeDigest: input.storeDigest,
          leaseTokenHash: null, leasedAt: null, heartbeatAt: null,
          leaseExpiresAt: null, finishedAt: now },
      });
      if (claimed.count !== 1) throw conflict();
      await freezeBuild(tx, input);
    });
  }

  async freezeReuse(input: { buildRunId: string; fetchRunId: string;
    cacheGeneration: number; storeDigest: string }) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.releaseDependencyFetchRun.findFirst({ where: {
        id: input.fetchRunId, cacheGeneration: input.cacheGeneration,
        status: "succeeded", storeDigest: input.storeDigest } });
      if (!row) throw conflict();
      await freezeBuild(tx, input);
    });
  }

  async invalidateSucceeded(fetchRunId: string, cacheGeneration: number,
    storeDigest: string) {
    const result = await this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: fetchRunId, cacheGeneration, status: "succeeded", storeDigest },
      data: { status: "invalidated", storeDigest: null,
        errorCode: "dependency_store_invalidated", finishedAt: new Date() },
    });
    if (result.count === 1) return;
    const current = await this.prisma.releaseDependencyFetchRun.findUnique({
      where: { id: fetchRunId }, select: { cacheGeneration: true, status: true } });
    if (current && (current.cacheGeneration > cacheGeneration ||
      (current.cacheGeneration === cacheGeneration && current.status === "invalidated")))
      return;
    throw conflict();
  }

  async finish(input: { fetchRunId: string; leaseToken: string;
    cacheGeneration: number;
    status: "failed" | "blocked" | "unavailable";
    code: string; message: string }, now = new Date()) {
    const result = await this.prisma.releaseDependencyFetchRun.updateMany({
      where: { id: input.fetchRunId, cacheGeneration: input.cacheGeneration,
        status: { in: ["fetching", "verifying"] },
        leaseTokenHash: dependencyFetchLeaseTokenHash(input.leaseToken),
        leaseExpiresAt: { gt: now } },
      data: { status: input.status, errorCode: input.code,
        errorMessage: input.message, leaseTokenHash: null, leasedAt: null,
        heartbeatAt: null, leaseExpiresAt: null, finishedAt: now },
    });
    if (result.count !== 1) throw conflict();
  }
}

async function freezeBuild(tx: Pick<PrismaService, "buildRun">, input: {
  buildRunId: string; fetchRunId: string; cacheGeneration: number;
  storeDigest: string }) {
  const frozen = await tx.buildRun.updateMany({ where: {
    id: input.buildRunId, status: "running", OR: [
      { dependencyFetchRunId: null, dependencyStoreDigest: null,
        dependencyStoreGeneration: null },
      { dependencyFetchRunId: input.fetchRunId,
        dependencyStoreDigest: input.storeDigest,
        dependencyStoreGeneration: input.cacheGeneration }] },
    data: { dependencyFetchRunId: input.fetchRunId,
      dependencyStoreDigest: input.storeDigest,
      dependencyStoreGeneration: input.cacheGeneration } });
  if (frozen.count !== 1) throw conflict();
}
function persistentIdentity(input: ReserveInput) {
  const { buildRunId: _build, fetchRunId: _fetch, ...identity } = input;
  return identity;
}
function assertImmutable(row: Record<string, unknown>, input: ReserveInput) {
  for (const key of ["combinationHash", "lockfileDigest", "profileId",
    "profileVersion", "profileSnapshotHash", "supplyChainDigest", "fetchImage",
    "jobImage", "pnpmVersion", "platformOs", "platformArch", "platformAbi",
    "platformLibc", "registryPolicyDigest"] as const) if (row[key] !== input[key])
    throw new ConflictException("依赖预取组合哈希与不可变输入不一致");
}
function conflict() { return new ConflictException("依赖预取状态已被其他执行占用"); }
