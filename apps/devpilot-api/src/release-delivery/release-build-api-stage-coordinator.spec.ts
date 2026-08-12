import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coordinateWorkerDependency } from "./release-build-api-stage-coordinator";
import { readImmutableWorkerJson, workerJobDirectory,
  writeImmutableWorkerJson } from "./release-build-worker-exchange";
import type { ReleaseBuildWorkerIdentity,
  ReleaseBuildWorkerRequestIdentity } from "./release-build-worker-envelope.policy";
import { signWorkerDependencyStage, signWorkerScanReady,
  verifyWorkerDependencyAssignment, verifyWorkerDependencyStage,
  type ReleaseBuildWorkerDependencyAssignment,
  type ReleaseBuildWorkerDependencyStage,
} from "./release-build-worker-stage-envelope.policy";

const secret = "stage-coordinator-secret-at-least-32-bytes";

describe("release build API stage coordinator", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "build-stages-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("marks fetching only after an exact signed worker start ack", async () => {
    const runtime = runtimeFixture(root);
    const base = identity();
    const inputDirectory = await workerJobDirectory(runtime.workerInputRoot,
      base.jobId, true, runtime.workerSharedGid);
    const outputDirectory = await workerJobDirectory(runtime.workerOutputRoot,
      base.jobId, true, runtime.workerSharedGid);
    await writeImmutableWorkerJson(outputDirectory, "scan-ready.json",
      signWorkerScanReady({ version: 1, identity: base, security: {} }, secret));
    const dependency = dependencyFixture();
    const dependencies = {
      prepare: jest.fn().mockResolvedValue(dependency),
      startFetch: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
    };
    const coordinated = coordinateWorkerDependency({ runtime: runtime as never,
      dependencies: dependencies as never, request: {
        buildRunId: base.buildRunId, checkoutRoot: root } as never,
      identity: base, manifest: { version: 1, entries: [], digest: "manifest" },
      secret, jobImage: dependency.jobImage, supplyChainDigest: "supply",
      dependencyNetworkMode: "direct-public-dns-v1",
      engineEvidenceDigest: "e".repeat(64) });

    const assignment = await waitFor<ReleaseBuildWorkerDependencyAssignment>(
      join(inputDirectory, "dependency-assignment.json"));
    expect(verifyWorkerDependencyAssignment(assignment, secret, base)).toBe(true);
    expect(dependencies.startFetch).not.toHaveBeenCalled();
    await writeImmutableWorkerJson(outputDirectory, "fetch-starting.json",
      signWorkerDependencyStage({ version: 1, identity: assignment.identity,
        stage: "fetch-starting" }, secret));
    const assigned = await coordinated;
    expect(dependencies.startFetch).toHaveBeenCalledWith(base.buildRunId, dependency);
    const authorization = await waitFor<ReleaseBuildWorkerDependencyStage>(
      join(inputDirectory, "fetch-authorized.json"));
    expect(verifyWorkerDependencyStage(authorization, secret, assigned,
      "fetch-authorized")).toBe(true);
  });
});

function runtimeFixture(root: string) {
  return { workerInputRoot: join(root, "input"), workerOutputRoot: join(root, "output"),
    workerSharedGid: process.getgid?.() ?? 1, workerPollIntervalMs: 5 };
}
function identity(): ReleaseBuildWorkerRequestIdentity {
  return { contract: "external-oci-launcher-v1", jobId: "job-stage-1234",
    projectId: "project-1", releaseOrderId: "order-1", buildRunId: "build-1",
    sourceCommitSha: "a".repeat(40), sourceTreeHash: "b".repeat(40),
    sourceSnapshotDigest: "c".repeat(64), sourceArchiveDigest: "d".repeat(64),
    sourceManifestDigest: "f".repeat(64), profileId: "controlled-local-acceptance-v2",
    profileVersion: 7, profileSnapshotHash: "9".repeat(64),
    deadline: new Date(Date.now() + 5_000).toISOString() };
}
function dependencyFixture(): ReleaseBuildWorkerIdentity["dependency"] {
  const image = `registry.test/api@sha256:${"7".repeat(64)}`;
  return { fetchRunId: `dep_${"1".repeat(64)}`, cacheGeneration: 1,
    combinationHash: "2".repeat(64), lockfileDigest: "3".repeat(64),
    profileId: "controlled-local-acceptance-v2", profileVersion: 7,
    profileSnapshotHash: "9".repeat(64), supplyChainDigest: "supply",
    fetchImage: image, jobImage: image, pnpmVersion: "8.12.0",
    platformOs: "linux", platformArch: "arm64", platformAbi: "node20",
    platformLibc: "glibc", registryPolicyDigest: "4".repeat(64),
    dependencyNetworkMode: "direct-public-dns-v1",
    engineEvidenceDigest: "e".repeat(64), mode: "fetch", storeDigest: null };
}
async function waitFor<T>(path: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { return await readImmutableWorkerJson<T>(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("stage file timeout");
}
