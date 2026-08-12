import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { coordinateWorkerDependency } from "./release-build-api-stage-coordinator";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseBuildSourceSnapshotService } from "./release-build-source-snapshot.service";
import type { ReleaseBuildExecutionInput,
  ReleaseBuildExecutionResult } from "./release-build.types";
import { ReleaseBuildExecutorPort } from "./release-build.types";
import { ReleaseDependencyApiCoordinator } from "./release-dependency-api-coordinator.service";
import {
  sameWorkerIdentity,
  signWorkerRequest,
  verifyWorkerDependencyReady,
  verifyWorkerResult,
  type ReleaseBuildWorkerIdentity,
  type ReleaseBuildWorkerRequestIdentity,
} from "./release-build-worker-envelope.policy";
import {
  workerJobDirectory,
  writeImmutableWorkerJson,
} from "./release-build-worker-exchange";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";
import { createWorkerSourceArchive } from "./release-build-worker-source-archive";
import {
  buildSourcePolicySnapshot,
  sourcePolicySnapshotHash,
} from "./source-policy-snapshot.policy";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { isolatedWorkerFailure as workerFailure, publishIsolatedWorkerCancel,
  readIsolatedWorkerResult, readWorkerDependencyReady, sourceEnvironment,
  DependencyStoreRetryError,
  workerDelay as delay } from "./release-build-isolated-executor.helpers";
@Injectable()
export class FilesystemIsolatedReleaseBuildExecutorService
  extends ReleaseBuildExecutorPort {
  private readonly jobs = new Map<string,
    ReleaseBuildWorkerRequestIdentity | ReleaseBuildWorkerIdentity>();
  constructor(
    private readonly runtime: ReleaseBuildRuntimeProfileService,
    private readonly snapshots: ReleaseBuildSourceSnapshotService,
    private readonly dependencies: ReleaseDependencyApiCoordinator,
  ) { super(); }
  async execute(input: ReleaseBuildExecutionInput, signal?: AbortSignal, dependencyRepairAttempt = 0): Promise<ReleaseBuildExecutionResult> {
    this.runtime.assertAvailable();
    const profile = resolveRegisteredReleaseBuildProfile(this.runtime.profile);
    if (!profile) throw new Error("Release Build worker profile is not registered");
    const secret = await readReleaseBuildWorkerSecret(this.runtime.workerSecretFile);
    const snapshot = await this.snapshots.verify({
      checkoutRoot: input.checkoutRoot,
      sourceCommitSha: input.sourceCommitSha,
      env: sourceEnvironment(this.runtime.commandPath),
      timeoutMs: this.runtime.commandTimeoutMs,
      cancelGraceMs: this.runtime.cancelGraceMs,
      signal,
    });
    const jobId = `${input.buildRunId}-${randomUUID().slice(0, 8)}`;
    const inputDirectory = await workerJobDirectory(
      this.runtime.workerInputRoot,
      jobId,
      true,
      this.runtime.workerSharedGid,
    );
    const archive = await createWorkerSourceArchive({
      checkoutRoot: input.checkoutRoot,
      sourceCommitSha: input.sourceCommitSha,
      jobDirectory: inputDirectory,
      env: sourceEnvironment(this.runtime.commandPath),
      timeoutMs: this.runtime.commandTimeoutMs,
      cancelGraceMs: this.runtime.cancelGraceMs,
      signal,
      sharedGid: this.runtime.workerSharedGid,
    });
    const afterArchive = await this.snapshots.verify({
      checkoutRoot: input.checkoutRoot,
      sourceCommitSha: input.sourceCommitSha,
      env: sourceEnvironment(this.runtime.commandPath),
      timeoutMs: this.runtime.commandTimeoutMs,
      cancelGraceMs: this.runtime.cancelGraceMs,
      signal,
    });
    if (afterArchive.snapshotDigest !== snapshot.snapshotDigest) {
      throw workerFailure("BUILD_SOURCE_CHANGED_DURING_ARCHIVE");
    }
    const deadline = new Date(Date.now() + this.runtime.runTimeoutMs);
    const profileSnapshot = buildSourcePolicySnapshot(profile);
    const profileSnapshotHash = sourcePolicySnapshotHash(profileSnapshot);
    const supplyChainDigest = expectedReleaseBuildSupplyProof(profile).supplyChainDigest;
    const dependencyNetwork = this.runtime.dependencyNetworkEvidence();
    const requestIdentity: ReleaseBuildWorkerRequestIdentity = {
      contract: "external-oci-launcher-v1",
      jobId,
      projectId: input.projectId,
      releaseOrderId: input.releaseOrderId,
      buildRunId: input.buildRunId,
      sourceCommitSha: input.sourceCommitSha,
      sourceTreeHash: snapshot.treeHash,
      sourceSnapshotDigest: snapshot.snapshotDigest,
      sourceArchiveDigest: archive.digest,
      sourceManifestDigest: archive.manifest.digest,
      profileId: profile.id,
      profileVersion: profile.profileVersion,
      profileSnapshotHash,
      deadline: deadline.toISOString(),
    };
    this.jobs.set(input.buildRunId, requestIdentity);
    await writeImmutableWorkerJson(inputDirectory, "request.json", signWorkerRequest({
      version: 1,
      identity: requestIdentity,
      components: input.components,
      sourceManifest: archive.manifest,
    }, secret), this.runtime.workerSharedGid);
    try {
      const identity = await coordinateWorkerDependency({ runtime: this.runtime,
        dependencies: this.dependencies, request: input, identity: requestIdentity,
        manifest: archive.manifest, secret, signal,
        jobImage: this.runtime.workerJobImage!, supplyChainDigest,
        ...dependencyNetwork });
      this.jobs.set(input.buildRunId, identity);
      return await this.awaitResult(identity, secret, signal);
    }
    catch (error) {
      if (error instanceof DependencyStoreRetryError) {
        if (dependencyRepairAttempt >= 1) throw workerFailure("DEPENDENCY_STORE_REPAIR_RETRY_EXHAUSTED");
        return this.execute(input, signal, dependencyRepairAttempt + 1);
      }
      throw error;
    }
  }

  async discardArtifact(input: { buildRunId: string }) {
    const identity = this.jobs.get(input.buildRunId);
    if (!identity) return;
    const secret = await readReleaseBuildWorkerSecret(this.runtime.workerSecretFile);
    await publishIsolatedWorkerCancel(this.runtime, identity, secret, "canceled");
    if ("dependency" in identity)
      await this.dependencies.cancel(identity.buildRunId, identity.dependency,
        "dependency_fetch_canceled");
  }

  private async awaitResult(
    identity: ReleaseBuildWorkerIdentity,
    secret: string,
    signal?: AbortSignal,
  ): Promise<ReleaseBuildExecutionResult> {
    let dependencyReady = false;
    while (Date.now() <= new Date(identity.deadline).getTime()) {
      if (signal?.aborted) {
        await publishIsolatedWorkerCancel(this.runtime, identity, secret, "canceled");
        await this.dependencies.cancel(identity.buildRunId, identity.dependency,
          "dependency_fetch_canceled");
        throw releaseBuildExecutionFailure(
          "BUILD_COMMAND_CANCELED", "隔离 Build Worker 已取消", [], "可重新构建。", "canceled",
        );
      }
      await this.dependencies.heartbeat(identity.buildRunId, identity.dependency);
      if (!dependencyReady) {
        const ready = await readWorkerDependencyReady(this.runtime, identity)
          .catch((error) => (error as NodeJS.ErrnoException).code === "ENOENT"
            ? null : Promise.reject(error));
        if (ready) {
          if (!verifyWorkerDependencyReady(ready, secret) ||
            !sameWorkerIdentity(ready.identity, identity))
            throw workerFailure("UNTRUSTED_DEPENDENCY_READY_INVALID");
          await this.dependencies.acceptReady(identity.buildRunId,
            identity.dependency, ready.dependencyStore);
          dependencyReady = true;
        }
      }
      const result = await readIsolatedWorkerResult(this.runtime, identity).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      });
      if (result) {
        if (!verifyWorkerResult(result, secret) ||
          !sameWorkerIdentity(result.identity, identity)) {
          await this.dependencies.cancel(identity.buildRunId, identity.dependency,
            "dependency_attestation_invalid");
          throw workerFailure("UNTRUSTED_WORKER_ATTESTATION_INVALID");
        }
        const action = await this.dependencies.acceptFinal(identity.buildRunId,
          identity.dependency, result);
        if (action === "retry") throw new DependencyStoreRetryError();
        if (result.status === "succeeded" && !dependencyReady)
          throw workerFailure("DEPENDENCY_READY_EVIDENCE_MISSING");
        if (result.status === "succeeded" && result.result) return result.result;
        if (result.failure) throw new ReleaseBuildExecutionError(result.failure);
        throw workerFailure(result.error?.code || "UNTRUSTED_WORKER_FAILED");
      }
      await delay(this.runtime.workerPollIntervalMs);
    }
    await publishIsolatedWorkerCancel(this.runtime, identity, secret, "timeout");
    await this.dependencies.cancel(identity.buildRunId, identity.dependency,
      "dependency_fetch_timeout");
    throw workerFailure("UNTRUSTED_WORKER_TIMEOUT");
  }
}
