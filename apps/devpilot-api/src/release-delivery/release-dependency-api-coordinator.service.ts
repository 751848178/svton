import { Injectable } from "@nestjs/common";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { ReleaseDependencyFetchRepository } from "./release-dependency-fetch.repository";
import { evaluateReleaseDependencyLock } from "./release-dependency-lock.policy";
import { readSignedPnpmLock } from "./release-dependency-lock.reader";
import type { ReleaseBuildWorkerResult } from "./release-build-worker-envelope.policy";
import type { DependencyFetchIdentity } from "./release-dependency-fetch-oci-runner";
import type { WorkerSourceManifest } from "./release-build-worker-source-manifest";

@Injectable()
export class ReleaseDependencyApiCoordinator {
  constructor(private readonly repository: ReleaseDependencyFetchRepository) {}

  async prepare(input: { buildRunId: string; checkoutRoot: string;
    manifest: WorkerSourceManifest; profileId: string; deadline: Date }) {
    const profile = resolveRegisteredReleaseBuildProfile(input.profileId);
    if (!profile) throw unavailable("dependency_profile_missing");
    const bytes = await readSignedPnpmLock(input.checkoutRoot, input.manifest);
    const verdict = evaluateReleaseDependencyLock({ manifest: input.manifest,
      bytes, profile, platformArch: platformArch() });
    if (!verdict.allowed) throw unavailable(verdict.detailCode);
    const policy = profile.dependencyStorePolicy;
    const identity = { fetchRunId: verdict.fetchRunId,
      combinationHash: verdict.combinationHash,
      lockfileDigest: verdict.lockfileDigest, profileId: profile.id,
      profileVersion: profile.profileVersion, pnpmVersion: policy.pnpmVersion,
      platformOs: policy.platformOs, platformArch: platformArch(),
      registryPolicyDigest: policy.registryPolicyDigest };
    let reservation = await this.repository.reserve({ buildRunId: input.buildRunId,
      ...identity });
    while (reservation.role === "wait" && Date.now() < input.deadline.getTime()) {
      await delay(250);
      const row = await this.repository.get(identity.fetchRunId);
      if (row?.status === "succeeded" && row.storeDigest)
        return { ...identity, mode: "reuse" as const, leaseToken: null,
          storeDigest: row.storeDigest };
      if (row && ["failed", "blocked", "unavailable"].includes(row.status))
        throw unavailable(row.errorCode || "dependency_fetch_failed");
      reservation = { ...reservation, row: row ?? reservation.row };
    }
    if (reservation.role === "wait") throw unavailable("dependency_fetch_wait_timeout");
    return reservation.role === "reuse"
      ? { ...identity, mode: "reuse" as const, leaseToken: null,
          storeDigest: reservation.row.storeDigest! }
      : { ...identity, mode: "fetch" as const,
          leaseToken: reservation.row.leaseToken!, storeDigest: null };
  }

  async acceptResult(buildRunId: string, dependency: DependencyFetchIdentity & {
    mode: "fetch" | "reuse"; leaseToken: string | null; storeDigest: string | null;
  }, result: ReleaseBuildWorkerResult) {
    const evidence = result.dependencyStore;
    if (dependency.mode === "reuse") {
      if (!evidence || evidence.storeDigest !== dependency.storeDigest)
        throw unavailable("dependency_store_reuse_unverified");
      return;
    }
    if (!evidence || evidence.fetchRunId !== dependency.fetchRunId ||
      evidence.combinationHash !== dependency.combinationHash) {
      await this.repository.fail({ fetchRunId: dependency.fetchRunId,
        leaseToken: dependency.leaseToken!, status: "failed",
        code: "dependency_fetch_result_missing", message: "依赖预取未返回可信摘要" });
      throw unavailable("dependency_fetch_result_missing");
    }
    await this.repository.markVerifying(dependency.fetchRunId, dependency.leaseToken!);
    await this.repository.succeed({ buildRunId, fetchRunId: dependency.fetchRunId,
      leaseToken: dependency.leaseToken!, storeDigest: evidence.storeDigest });
  }
}

function platformArch(): "amd64" | "arm64" {
  if (process.arch === "x64") return "amd64";
  if (process.arch === "arm64") return "arm64";
  throw unavailable("dependency_platform_unsupported");
}
function unavailable(reasonCode: string) {
  return releaseBuildExecutionFailure("BUILD_DEPENDENCY_STORE_UNAVAILABLE",
    "锁文件依赖存储不可用", [], "修复锁文件依赖策略或重新执行预取。", "failed",
    { dependencyStore: { status: "unavailable", reasonCode } });
}
function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
