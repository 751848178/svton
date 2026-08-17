import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { ReleaseDependencyApiCoordinator } from "./release-dependency-api-coordinator.service";
import { buildSourcePolicySnapshot,
  sourcePolicySnapshotHash } from "./source-policy-snapshot.policy";

describe("ReleaseDependencyApiCoordinator", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "dep-api-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("releases a fresh lease as soon as signed dependency evidence is ready", async () => {
    const repository = repo({ role: "owner", row: { storeDigest: null,
      cacheGeneration: 1 },
      leaseToken: "raw" });
    const coordinator = new ReleaseDependencyApiCoordinator(repository as never);
    const dependency = await coordinator.prepare(await input());
    expect(dependency.mode).toBe("fetch");
    await coordinator.acceptReady("build-1", dependency, evidence(dependency, "digest"));
    expect(repository.markVerifying).toHaveBeenCalledWith(
      dependency.fetchRunId, 1, "raw");
    expect(repository.succeed).toHaveBeenCalledWith(expect.objectContaining({
      buildRunId: "build-1", storeDigest: "digest" }));
    await coordinator.heartbeat("build-1", dependency);
    expect(repository.heartbeat).not.toHaveBeenCalled();
  });

  it("freezes verified reuse without reserving or mutating shared status", async () => {
    const repository = repo({ role: "reuse", row: { storeDigest: "digest",
      cacheGeneration: 2 } });
    const coordinator = new ReleaseDependencyApiCoordinator(repository as never);
    const dependency = await coordinator.prepare(await input());
    await coordinator.acceptReady("build-1", dependency, evidence(dependency, "digest"));
    expect(repository.freezeReuse).toHaveBeenCalledWith(expect.objectContaining({
      buildRunId: "build-1", storeDigest: "digest" }));
    expect(repository.markVerifying).not.toHaveBeenCalled();
  });

  it("invalidates a quarantined reuse before requesting one bounded retry", async () => {
    const repository = repo({ role: "reuse", row: { storeDigest: "digest",
      cacheGeneration: 2 } });
    const coordinator = new ReleaseDependencyApiCoordinator(repository as never);
    const dependency = await coordinator.prepare(await input());
    await expect(coordinator.acceptFinal("build-1", dependency, {
      failure: { code: "BUILD_DEPENDENCY_STORE_INVALIDATED" },
    } as never)).resolves.toBe("retry");
    expect(repository.invalidateSucceeded).toHaveBeenCalledWith(
      dependency.fetchRunId, 2, "digest");
  });

  it("finishes and forgets an active lease when ready publication fails", async () => {
    const repository = repo({ role: "owner", row: { storeDigest: null,
      cacheGeneration: 3 }, leaseToken: "raw" });
    const coordinator = new ReleaseDependencyApiCoordinator(repository as never);
    const dependency = await coordinator.prepare(await input());
    await expect(coordinator.acceptFinal("build-1", dependency, {
      status: "failed", failure: { code: "dependency_ready_publish_failed" },
      dependencyStore: evidence(dependency, "digest"),
    } as never)).resolves.toBe("complete");
    expect(repository.finish).toHaveBeenCalledWith(expect.objectContaining({
      cacheGeneration: 3, code: "dependency_ready_publish_failed" }));
    await coordinator.heartbeat("build-1", dependency);
    expect(repository.heartbeat).not.toHaveBeenCalled();
  });

  it("blocks a successful final result that skipped dependency-ready", async () => {
    const repository = repo({ role: "owner", row: { storeDigest: null,
      cacheGeneration: 4 }, leaseToken: "raw" });
    const coordinator = new ReleaseDependencyApiCoordinator(repository as never);
    const dependency = await coordinator.prepare(await input());
    await expect(coordinator.acceptFinal("build-1", dependency, {
      status: "succeeded", dependencyStore: evidence(dependency, "digest"),
    } as never)).rejects.toMatchObject({ detail: { gateSummary: {
      dependencyStore: { reasonCode: "DEPENDENCY_READY_EVIDENCE_MISSING" } } } });
    expect(repository.finish).toHaveBeenCalledWith(expect.objectContaining({
      cacheGeneration: 4, code: "DEPENDENCY_READY_EVIDENCE_MISSING" }));
    await coordinator.heartbeat("build-1", dependency);
    expect(repository.heartbeat).not.toHaveBeenCalled();
  });

  it("preserves the worker failure after an idempotent lease takeover", async () => {
    const repository = repo({ role: "owner", row: { storeDigest: null,
      cacheGeneration: 5 }, leaseToken: "raw" });
    repository.finish.mockResolvedValue(undefined);
    const coordinator = new ReleaseDependencyApiCoordinator(repository as never);
    const dependency = await coordinator.prepare(await input());
    await expect(coordinator.acceptFinal("build-1", dependency, {
      status: "failed", failure: { code: "ORIGINAL_WORKER_FAILURE" },
    } as never)).resolves.toBe("complete");
    expect(repository.finish).toHaveBeenCalledWith(expect.objectContaining({
      code: "ORIGINAL_WORKER_FAILURE" }));
  });

  it("surfaces a permanent blocked reason instead of entering the wait loop", async () => {
    const repository = repo({ role: "blocked",
      row: { errorCode: "dependency_private_registry_forbidden" } });
    const coordinator = new ReleaseDependencyApiCoordinator(repository as never);
    await expect(coordinator.prepare(await input())).rejects.toMatchObject({
      detail: { gateSummary: { dependencyStore: {
        reasonCode: "dependency_private_registry_forbidden" } } } });
    expect(repository.reserve).toHaveBeenCalledTimes(1);
  });

  async function input() {
    const profile = resolveRegisteredReleaseBuildProfile("controlled-local-acceptance-v2")!;
    const bytes = Buffer.from("lockfileVersion: '6.0'\npackages: {}\n");
    await writeFile(join(root, "pnpm-lock.yaml"), bytes);
    const manifest = { version: 1 as const, entries: [{ path: "pnpm-lock.yaml",
      mode: "100644" as const, sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") }],
      digest: "a".repeat(64) };
    return { buildRunId: "build-1", checkoutRoot: root, manifest,
      profileId: profile.id, deadline: new Date(Date.now() + 5_000),
      profileSnapshotHash: sourcePolicySnapshotHash(buildSourcePolicySnapshot(profile)),
      supplyChainDigest: expectedReleaseBuildSupplyProof(profile).supplyChainDigest,
      jobImage: `registry.test/api@sha256:${"7".repeat(64)}`,
      dependencyNetworkMode: "direct-public-dns-v1" as const,
      engineEvidenceDigest: "8".repeat(64) };
  }
});

function evidence(dependency: { fetchRunId: string; cacheGeneration: number;
  combinationHash: string },
  storeDigest: string) {
  return { fetchRunId: dependency.fetchRunId,
    cacheGeneration: dependency.cacheGeneration,
    combinationHash: dependency.combinationHash, storeDigest };
}
function repo(reservation: object) {
  return { reserve: jest.fn().mockResolvedValue(reservation),
    markVerifying: jest.fn(), succeed: jest.fn(), freezeReuse: jest.fn(),
    invalidateSucceeded: jest.fn(), heartbeat: jest.fn(), finish: jest.fn() };
}
