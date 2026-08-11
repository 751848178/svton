import { dependencyFetchLeaseTokenHash } from "./release-dependency-lease.policy";
import { ReleaseDependencyFetchRepository } from "./release-dependency-fetch.repository";

describe("ReleaseDependencyFetchRepository", () => {
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
        leaseTokenHash: dependencyFetchLeaseTokenHash("raw") }),
      data: expect.objectContaining({ status: "failed", leaseTokenHash: null,
        leaseExpiresAt: null }),
    }));
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
    findUnique: jest.fn().mockResolvedValue(value) };
  const build = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  const prisma = { releaseDependencyFetchRun: fetch, buildRun: build,
    $transaction: jest.fn().mockImplementation((callback) => callback({
      releaseDependencyFetchRun: fetch, buildRun: build })) };
  return { prisma, fetch, build };
}
