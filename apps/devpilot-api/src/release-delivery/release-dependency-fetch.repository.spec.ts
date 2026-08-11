import { dependencyFetchLeaseTokenHash } from "./release-dependency-lease.policy";
import { ReleaseDependencyFetchRepository } from "./release-dependency-fetch.repository";

describe("ReleaseDependencyFetchRepository", () => {
  it("cold-creates the Prisma row with the deterministic id and no stray field", async () => {
    const fixture = setup(row("queued"), 1);
    await repository(fixture).reserve(input());
    const create = fixture.fetch.upsert.mock.calls[0][0].create;
    expect(create).toMatchObject({ id: "dep_hash", combinationHash: "hash" });
    expect(create).not.toHaveProperty("fetchRunId");
    expect(create).not.toHaveProperty("buildRunId");
  });

  it("probes succeeded reuse without taking a lease or changing shared status", async () => {
    const fixture = setup({ ...row("succeeded"), storeDigest: "store-digest" }, 1);
    await expect(repository(fixture).reserve(input()))
      .resolves.toMatchObject({ role: "reuse", row: { storeDigest: "store-digest" } });
    expect(fixture.fetch.updateMany).not.toHaveBeenCalled();
  });

  it("returns a permanent blocked reason without waiting or reserving", async () => {
    const fixture = setup({ ...row("blocked"), errorCode: "private_dependency" }, 1);
    await expect(repository(fixture).reserve(input()))
      .resolves.toMatchObject({ role: "blocked",
        row: { errorCode: "private_dependency" } });
    expect(fixture.fetch.updateMany).not.toHaveBeenCalled();
  });
  it("persists only a hash while returning the raw lease to the API", async () => {
    const fixture = setup(row("queued"), 1);
    const result = await repository(fixture).reserve(input());
    expect(result.role).toBe("owner");
    if (result.role !== "owner") throw new Error("owner expected");
    expect(result.leaseToken).toMatch(/^[a-f0-9]{64}$/);
    expect(fixture.fetch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        leaseTokenHash: dependencyFetchLeaseTokenHash(result.leaseToken),
        leaseExpiresAt: expect.any(Date), heartbeatAt: expect.any(Date),
      }),
    }));
    expect(JSON.stringify(fixture.fetch.updateMany.mock.calls))
      .not.toContain(result.leaseToken);
  });

  it.each(["fetching", "verifying"])("reclaims an expired %s lease", async (status) => {
    const fixture = setup({ ...row(status),
      leaseExpiresAt: new Date(Date.now() - 1_000) }, 1);
    await expect(repository(fixture).reserve(input()))
      .resolves.toMatchObject({ role: "owner" });
    expect(fixture.fetch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.arrayContaining([
        expect.objectContaining({ status: { in: ["fetching", "verifying"] } }),
      ]) }),
    }));
  });

  it("waits while an unexpired owner holds the combination", async () => {
    const fixture = setup(row("fetching"), 0);
    await expect(repository(fixture).reserve(input()))
      .resolves.toMatchObject({ role: "wait" });
  });

  it.each(["failed", "unavailable"])("retries terminal %s fetches", async (status) => {
    const fixture = setup(row(status), 1);
    await expect(repository(fixture).reserve(input()))
      .resolves.toMatchObject({ role: "owner" });
  });

  it("allows a bounded waiter to reserve after the prior lease becomes stale", async () => {
    const fixture = setup(row("fetching"), 0);
    fixture.fetch.updateMany.mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    await expect(repository(fixture).reserve(input()))
      .resolves.toMatchObject({ role: "wait" });
    await expect(repository(fixture).reserve(input()))
      .resolves.toMatchObject({ role: "owner" });
  });

  it("CAS terminates a canceled lease and clears its persisted hash", async () => {
    const fixture = setup(row("fetching"), 1);
    await repository(fixture).finish({ fetchRunId: "dep_hash", leaseToken: "raw",
      status: "failed", code: "canceled", message: "canceled" });
    expect(fixture.fetch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        leaseTokenHash: dependencyFetchLeaseTokenHash("raw"),
        leaseExpiresAt: { gt: expect.any(Date) } }),
      data: expect.objectContaining({ status: "failed", leaseTokenHash: null,
        leaseExpiresAt: null }),
    }));
  });

  it("rejects terminal writes after the lease expired", async () => {
    const fixture = setup(row("fetching"), 0);
    await expect(repository(fixture).finish({ fetchRunId: "dep_hash",
      leaseToken: "raw", status: "failed", code: "late", message: "late" }))
      .rejects.toThrow("依赖预取状态已被其他执行占用");
  });

  it("atomically completes the store and freezes the BuildRun relation", async () => {
    const fixture = setup(row("verifying"), 1);
    const token = "raw-token";
    await repository(fixture).succeed({ buildRunId: "build-1",
      fetchRunId: "dep_hash", leaseToken: token, storeDigest: "store-digest" });
    expect(fixture.fetch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        leaseTokenHash: dependencyFetchLeaseTokenHash(token) }),
      data: expect.objectContaining({ status: "succeeded" }),
    }));
    expect(fixture.build.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { dependencyFetchRunId: "dep_hash",
        dependencyStoreDigest: "store-digest" },
    }));
  });

  it("freezes verified reuse without mutating the succeeded shared row", async () => {
    const fixture = setup({ ...row("succeeded"), storeDigest: "store-digest" }, 1);
    await repository(fixture).freezeReuse({ buildRunId: "build-2",
      fetchRunId: "dep_hash", storeDigest: "store-digest" });
    expect(fixture.fetch.findFirst).toHaveBeenCalledWith({ where: {
      id: "dep_hash", status: "succeeded", storeDigest: "store-digest" } });
    expect(fixture.build.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [
        { dependencyFetchRunId: null, dependencyStoreDigest: null },
        { dependencyFetchRunId: "dep_hash", dependencyStoreDigest: "store-digest" }] }),
    }));
    expect(fixture.fetch.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a cross-build freeze race and a different digest overwrite", async () => {
    const fixture = setup(row("verifying"), 1);
    fixture.build.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository(fixture).succeed({ buildRunId: "build-1",
      fetchRunId: "dep_hash", leaseToken: "raw", storeDigest: "new" }))
      .rejects.toThrow("依赖预取状态已被其他执行占用");
    expect(fixture.fetch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [
        { storeDigest: null }, { storeDigest: "new" }] }),
    }));
  });
});

function repository(fixture: ReturnType<typeof setup>) {
  return new ReleaseDependencyFetchRepository(fixture.prisma as never);
}
function input() {
  const image = `registry.test/api@sha256:${"7".repeat(64)}`;
  return { buildRunId: "build-1", fetchRunId: "dep_hash",
    combinationHash: "hash", lockfileDigest: "lock", profileId: "profile",
    profileVersion: 6, profileSnapshotHash: "snapshot", supplyChainDigest: "supply",
    fetchImage: image, jobImage: image, pnpmVersion: "8.12.0",
    platformOs: "linux" as const, platformArch: "arm64" as const,
    platformAbi: "node20", platformLibc: "glibc", registryPolicyDigest: "policy" };
}
function row(status: string) {
  return { id: "dep_hash", ...input(), status, storeDigest: null,
    leaseTokenHash: "lease-hash", leasedAt: new Date(),
    leaseExpiresAt: new Date(Date.now() + 60_000), heartbeatAt: new Date(),
    errorCode: null, errorMessage: null, finishedAt: null,
    createdAt: new Date(), updatedAt: new Date() };
}
function setup(value: Record<string, unknown>, claim: number) {
  const fetch = { upsert: jest.fn().mockResolvedValue(value),
    updateMany: jest.fn().mockResolvedValue({ count: claim }),
    findFirst: jest.fn().mockResolvedValue(value),
    findUnique: jest.fn().mockResolvedValue(value) };
  const build = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  const prisma = { releaseDependencyFetchRun: fetch, buildRun: build,
    $transaction: jest.fn().mockImplementation((callback) => callback({
      releaseDependencyFetchRun: fetch, buildRun: build })) };
  return { prisma, fetch, build };
}
