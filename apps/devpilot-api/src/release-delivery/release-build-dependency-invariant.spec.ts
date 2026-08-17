import { assertBuildDependencyStoreSucceeded } from "./release-build-dependency-invariant";

describe("Build dependency-store success invariant", () => {
  it("allows an exact frozen BuildRun and signed worker evidence", async () => {
    const tx = fixture({ dependencyFetchRunId: "dep-1",
      dependencyStoreDigest: "digest", dependencyStoreGeneration: 2 });
    await expect(assertBuildDependencyStoreSucceeded(tx as never, "build-1", gate()))
      .resolves.toBeUndefined();
  });

  it.each([
    null,
    { dependencyFetchRunId: null, dependencyStoreDigest: null },
  ])("blocks artifact commit without the exact dependency store", async (row) => {
    await expect(assertBuildDependencyStoreSucceeded(
      fixture(row) as never, "build-1", gate()))
      .rejects.toThrow("依赖存储尚未完成可信冻结");
  });

  it("ignores mutable shared fetch status but rejects mismatched worker evidence", async () => {
    const tx = fixture({ dependencyFetchRunId: "dep-1",
      dependencyStoreDigest: "digest", dependencyStoreGeneration: 2 });
    await expect(assertBuildDependencyStoreSucceeded(tx as never, "build-1", {
      dependencyStore: { ...gate().dependencyStore, storeDigest: "other" } }))
      .rejects.toThrow("依赖存储尚未完成可信冻结");
    await expect(assertBuildDependencyStoreSucceeded(tx as never, "build-1", {
      dependencyStore: { ...gate().dependencyStore, cacheGeneration: 1 } }))
      .rejects.toThrow("依赖存储尚未完成可信冻结");
  });
});

function fixture(row: unknown) {
  return { buildRun: { findUnique: jest.fn().mockResolvedValue(row) } };
}
function gate() {
  return { dependencyStore: { status: "passed", fetchRunId: "dep-1",
    cacheGeneration: 2, storeDigest: "digest" } };
}
