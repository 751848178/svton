import { Injectable } from "@nestjs/common";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { ReleaseDependencyFetchRepository } from "./release-dependency-fetch.repository";
import { evaluateReleaseDependencyLock } from "./release-dependency-lock.policy";
import { readSignedPnpmLock } from "./release-dependency-lock.reader";
import type { ReleaseBuildWorkerResult } from "./release-build-worker-envelope.policy";
import type { DependencyFetchIdentity } from "./release-dependency-store-contract";
import type { WorkerSourceManifest } from "./release-build-worker-source-manifest";

type WorkerDependency = DependencyFetchIdentity & {
  mode: "fetch" | "reuse"; storeDigest: string | null };

@Injectable()
export class ReleaseDependencyApiCoordinator {
  private readonly active = new Map<string, {
    identity: DependencyFetchIdentity; leaseToken: string }>();
  constructor(private readonly repository: ReleaseDependencyFetchRepository) {}

  async prepare(input: { buildRunId: string; checkoutRoot: string;
    manifest: WorkerSourceManifest; profileId: string; deadline: Date;
    profileSnapshotHash: string; supplyChainDigest: string; jobImage: string }) {
    const profile = resolveRegisteredReleaseBuildProfile(input.profileId);
    if (!profile) throw unavailable("dependency_profile_missing");
    const bytes = await readSignedPnpmLock(input.checkoutRoot, input.manifest);
    const verdict = evaluateReleaseDependencyLock({ manifest: input.manifest,
      bytes, profile, platformArch: platformArch(), jobImage: input.jobImage });
    if (!verdict.allowed) throw unavailable(verdict.detailCode);
    if (verdict.profileSnapshotHash !== input.profileSnapshotHash ||
      verdict.supplyChainDigest !== input.supplyChainDigest)
      throw unavailable("dependency_profile_snapshot_mismatch");
    const policy = profile.dependencyStorePolicy;
    const identity: Omit<DependencyFetchIdentity, "cacheGeneration"> = {
      fetchRunId: verdict.fetchRunId, combinationHash: verdict.combinationHash,
      lockfileDigest: verdict.lockfileDigest, profileId: profile.id,
      profileVersion: profile.profileVersion,
      profileSnapshotHash: verdict.profileSnapshotHash,
      supplyChainDigest: verdict.supplyChainDigest,
      fetchImage: input.jobImage, jobImage: input.jobImage,
      pnpmVersion: policy.pnpmVersion, platformOs: policy.platformOs,
      platformArch: platformArch(), platformAbi: policy.platformAbi,
      platformLibc: policy.platformLibc,
      registryPolicyDigest: policy.registryPolicyDigest };
    while (Date.now() < input.deadline.getTime()) {
      const reservation = await this.repository.reserve({
        buildRunId: input.buildRunId, ...identity });
      if (reservation.role === "blocked")
        throw unavailable(reservation.row.errorCode || "dependency_policy_blocked");
      const generation = reservation.row.cacheGeneration;
      if (reservation.role === "reuse") return { ...identity,
        cacheGeneration: generation,
        mode: "reuse" as const, storeDigest: reservation.row.storeDigest! };
      if (reservation.role === "owner") {
        const claimedIdentity = { ...identity, cacheGeneration: generation };
        this.active.set(input.buildRunId, { identity: claimedIdentity,
          leaseToken: reservation.leaseToken });
        return { ...claimedIdentity, mode: "fetch" as const, storeDigest: null };
      }
      await delay(250);
    }
    throw unavailable("dependency_fetch_wait_timeout");
  }

  async acceptReady(buildRunId: string, dependency: WorkerDependency,
    evidence: { fetchRunId: string; cacheGeneration: number;
      combinationHash: string; storeDigest: string }) {
    assertEvidence(dependency, evidence);
    if (dependency.mode === "reuse") {
      await this.repository.freezeReuse({ buildRunId,
        fetchRunId: evidence.fetchRunId, cacheGeneration: evidence.cacheGeneration,
        storeDigest: evidence.storeDigest });
      return;
    }
    const leaseToken = this.lease(buildRunId, dependency);
    await this.repository.markVerifying(dependency.fetchRunId,
      dependency.cacheGeneration, leaseToken);
    await this.repository.succeed({ buildRunId, fetchRunId: dependency.fetchRunId,
      cacheGeneration: dependency.cacheGeneration, leaseToken,
      storeDigest: evidence.storeDigest });
    this.active.delete(buildRunId);
  }

  async acceptFinal(buildRunId: string, dependency: WorkerDependency,
    result: ReleaseBuildWorkerResult) {
    if (dependency.mode === "reuse" &&
      result.failure?.code === "BUILD_DEPENDENCY_STORE_INVALIDATED") {
      await this.repository.invalidateSucceeded(dependency.fetchRunId,
        dependency.cacheGeneration, dependency.storeDigest!);
      return "retry" as const;
    }
    if (result.status !== "succeeded" && this.active.has(buildRunId))
      await this.finishActive(buildRunId,
        result.failure?.code || "dependency_fetch_worker_failed");
    if (!result.dependencyStore) {
      await this.finishActive(buildRunId, "dependency_fetch_result_missing");
      throw unavailable("dependency_fetch_result_missing");
    }
    assertEvidence(dependency, result.dependencyStore);
    return "complete" as const;
  }

  async cancel(buildRunId: string, _dependency: DependencyFetchIdentity, code: string) {
    await this.finishActive(buildRunId, code);
  }

  async heartbeat(buildRunId: string, _dependency: DependencyFetchIdentity) {
    const active = this.active.get(buildRunId);
    if (!active) return;
    const result = await this.repository.heartbeat(active.identity.fetchRunId,
      active.identity.cacheGeneration, active.leaseToken);
    if (result.count !== 1) throw unavailable("dependency_fetch_lease_lost");
  }

  private async finishActive(buildRunId: string, code: string) {
    const active = this.active.get(buildRunId);
    if (!active) return;
    try {
      await this.repository.finish({ fetchRunId: active.identity.fetchRunId,
        cacheGeneration: active.identity.cacheGeneration,
        leaseToken: active.leaseToken, status: "failed", code,
        message: "依赖预取被取消或证明无效" });
    } finally { this.active.delete(buildRunId); }
  }
  private lease(buildRunId: string, dependency: DependencyFetchIdentity) {
    const active = this.active.get(buildRunId);
    if (!active || active.identity.fetchRunId !== dependency.fetchRunId)
      throw unavailable("dependency_fetch_lease_missing");
    return active.leaseToken;
  }
}

function assertEvidence(dependency: WorkerDependency, evidence: {
  fetchRunId: string; cacheGeneration: number;
  combinationHash: string; storeDigest: string }) {
  if (evidence.fetchRunId !== dependency.fetchRunId ||
    evidence.cacheGeneration !== dependency.cacheGeneration ||
    evidence.combinationHash !== dependency.combinationHash ||
    (dependency.mode === "reuse" && evidence.storeDigest !== dependency.storeDigest))
    throw unavailable("dependency_store_evidence_mismatch");
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
