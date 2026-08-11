import { assertBuildDependencyStoreSucceeded } from "./release-build-dependency-invariant";

describe("Build dependency-store success invariant", () => {
  it("allows only an exact succeeded fetch digest", async () => {
    const tx = fixture({ dependencyFetchRunId: "dep-1",
      dependencyStoreDigest: "digest", dependencyFetchRun: {
        status: "succeeded", storeDigest: "digest" } });
    await expect(assertBuildDependencyStoreSucceeded(tx as never, "build-1"))
      .resolves.toBeUndefined();
  });

  it.each([
    null,
    { dependencyFetchRunId: null, dependencyStoreDigest: null,
      dependencyFetchRun: null },
    { dependencyFetchRunId: "dep-1", dependencyStoreDigest: "digest",
      dependencyFetchRun: { status: "fetching", storeDigest: null } },
    { dependencyFetchRunId: "dep-1", dependencyStoreDigest: "digest",
      dependencyFetchRun: { status: "succeeded", storeDigest: "other" } },
  ])("blocks artifact commit without the exact dependency store", async (row) => {
    await expect(assertBuildDependencyStoreSucceeded(fixture(row) as never, "build-1"))
      .rejects.toThrow("依赖存储尚未完成可信冻结");
  });
});

function fixture(row: unknown) {
  return { buildRun: { findUnique: jest.fn().mockResolvedValue(row) } };
}
