import { ReleaseDependencyFetchRepository } from "./release-dependency-fetch.repository";

describe("ReleaseDependencyFetchRepository", () => {
  it("reserves one fetching owner and freezes the BuildRun relation", async () => {
    const fixture = setup(row("queued"), 1);
    const result = await new ReleaseDependencyFetchRepository(fixture.prisma as never)
      .reserve(input());
    expect(result.role).toBe("owner");
    expect(fixture.fetch.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "fetching" }),
    }));
    expect(fixture.build.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { dependencyFetchRunId: "dep_hash" },
    }));
  });

  it("does not create a second owner while the same combination is leased", async () => {
    const fixture = setup(row("fetching"), 0);
    const result = await new ReleaseDependencyFetchRepository(fixture.prisma as never)
      .reserve(input());
    expect(result.role).toBe("wait");
  });

  it("reuses only an exact succeeded immutable store", async () => {
    const fixture = setup({ ...row("succeeded"), storeDigest: "store-digest" }, 0);
    const result = await new ReleaseDependencyFetchRepository(fixture.prisma as never)
      .reserve(input());
    expect(result).toMatchObject({ role: "reuse",
      row: { storeDigest: "store-digest" } });
    expect(fixture.fetch.updateMany).not.toHaveBeenCalled();
  });

  it("CASes verifying and store completion before freezing its digest", async () => {
    const fixture = setup(row("fetching"), 1);
    const repository = new ReleaseDependencyFetchRepository(fixture.prisma as never);
    await repository.markVerifying("dep_hash", "lease");
    await repository.succeed({ buildRunId: "build-1", fetchRunId: "dep_hash",
      leaseToken: "lease", storeDigest: "store-digest" });
    expect(fixture.fetch.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "verifying", leaseToken: "lease" }),
      data: expect.objectContaining({ status: "succeeded",
        storeDigest: "store-digest" }),
    }));
    expect(fixture.build.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { dependencyStoreDigest: "store-digest" },
    }));
  });
});

function input() {
  return { buildRunId: "build-1", fetchRunId: "dep_hash",
    combinationHash: "hash", lockfileDigest: "lock", profileId: "profile",
    profileVersion: 6, pnpmVersion: "8.12.0", platformOs: "linux",
    platformArch: "arm64", registryPolicyDigest: "policy" };
}
function row(status: string) {
  return { id: "dep_hash", ...input(), status, storeDigest: null,
    leaseToken: "lease", leasedAt: new Date(), errorCode: null,
    errorMessage: null, finishedAt: null, createdAt: new Date(),
    updatedAt: new Date() };
}
function setup(value: Record<string, unknown>, claim: number) {
  const fetch = {
    upsert: jest.fn().mockResolvedValue(value),
    updateMany: jest.fn().mockResolvedValue({ count: claim }),
    findUnique: jest.fn().mockResolvedValue(value),
  };
  const build = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  const prisma = { releaseDependencyFetchRun: fetch, buildRun: build,
    $transaction: jest.fn().mockImplementation((callback) =>
      typeof callback === "function" ? callback({
        releaseDependencyFetchRun: fetch, buildRun: build,
      }) : Promise.all(callback)) };
  return { prisma, fetch, build };
}
