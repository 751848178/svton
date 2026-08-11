import { join } from "node:path";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { runDependencyFetchOci } from "./release-dependency-fetch-oci-runner";
import { evaluateReleaseDependencyLock } from "./release-dependency-lock.policy";
import { readSignedPnpmLock } from "./release-dependency-lock.reader";
import { quarantineDependencyStore,
  verifyDependencyStore } from "./release-dependency-store-filesystem";
import type { ReleaseBuildWorkerRequest } from "./release-build-worker-envelope.policy";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";

export async function prepareWorkerDependencyStore(input: {
  request: ReleaseBuildWorkerRequest; profile: RegisteredReleaseBuildProfile;
  sourceRoot: string; cacheRoot: string; jobRoot: string;
  externalOci?: { image: string; dockerExecutable: string; launcherLabel: string;
    dependencyNetworkMode: "docker-desktop-engine-proxy-v1" | "direct-public-dns-v1";
    engineEvidenceDigest: string };
  timeoutMs: number; signal?: AbortSignal;
}) {
  const lockfile = await readSignedPnpmLock(input.sourceRoot,
    input.request.sourceManifest);
  const expected = input.request.identity.dependency;
  const verdict = evaluateReleaseDependencyLock({
    manifest: input.request.sourceManifest, bytes: lockfile,
    profile: input.profile, platformArch: expected.platformArch,
    jobImage: expected.jobImage,
    dependencyNetworkMode: expected.dependencyNetworkMode,
    engineEvidenceDigest: expected.engineEvidenceDigest,
  });
  if (!verdict.allowed || verdict.fetchRunId !== expected.fetchRunId ||
    verdict.combinationHash !== expected.combinationHash ||
    verdict.lockfileDigest !== expected.lockfileDigest ||
    verdict.profileSnapshotHash !== expected.profileSnapshotHash ||
    verdict.supplyChainDigest !== expected.supplyChainDigest ||
    expected.profileId !== input.profile.id ||
    expected.profileVersion !== input.profile.profileVersion ||
    expected.pnpmVersion !== input.profile.dependencyStorePolicy.pnpmVersion ||
    expected.registryPolicyDigest !==
      input.profile.dependencyStorePolicy.registryPolicyDigest) throw invalid();
  const root = join(input.cacheRoot, expected.combinationHash);
  if (expected.mode === "reuse") {
    if (!expected.storeDigest) throw invalid();
    try {
      const manifest = await verifyDependencyStore(root, {
        combinationHash: expected.combinationHash,
        storeDigest: expected.storeDigest });
      return { root, manifest };
    } catch {
      await quarantineDependencyStore(root).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
      throw releaseBuildExecutionFailure("BUILD_DEPENDENCY_STORE_INVALIDATED",
        "依赖缓存证明损坏，已隔离并准备重新预取", [], "重新执行依赖预取。",
        "failed", { dependencyStore: { status: "invalidated",
          fetchRunId: expected.fetchRunId, storeDigest: expected.storeDigest } });
    }
  }
  if (expected.mode !== "fetch" || expected.storeDigest || !input.externalOci)
    throw invalid();
  const manifest = await runDependencyFetchOci({
    identity: expected, lockfile: verdict.sanitizedLockfile, cacheRoot: input.cacheRoot,
    jobRoot: input.jobRoot, image: input.externalOci.image,
    dockerExecutable: input.externalOci.dockerExecutable,
    launcherLabel: input.externalOci.launcherLabel,
    timeoutMs: input.timeoutMs, signal: input.signal,
  });
  return { root, manifest };
}

function invalid() {
  return new Error("Signed dependency store identity is invalid");
}
