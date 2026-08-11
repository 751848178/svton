import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { controlledBuildEnvironment } from "./release-build-command-policy";
import { releaseBuildExecutionFailure } from "./release-build-execution-failure";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseBuildSourceSnapshotService } from "./release-build-source-snapshot.service";
import type {
  ReleaseBuildExecutionInput,
  ReleaseBuildExecutionResult,
} from "./release-build.types";
import { ReleaseBuildExecutorPort } from "./release-build.types";
import {
  sameWorkerIdentity,
  signWorkerCancellation,
  signWorkerRequest,
  verifyWorkerResult,
  type ReleaseBuildWorkerIdentity,
  type ReleaseBuildWorkerResult,
} from "./release-build-worker-envelope.policy";
import {
  readImmutableWorkerJson,
  workerJobDirectory,
  writeImmutableWorkerJson,
} from "./release-build-worker-exchange";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";
import { createWorkerSourceArchive } from "./release-build-worker-source-archive";
import {
  buildSourcePolicySnapshot,
  sourcePolicySnapshotHash,
} from "./source-policy-snapshot.policy";

@Injectable()
export class FilesystemIsolatedReleaseBuildExecutorService
  extends ReleaseBuildExecutorPort {
  private readonly jobs = new Map<string, ReleaseBuildWorkerIdentity>();

  constructor(
    private readonly runtime: ReleaseBuildRuntimeProfileService,
    private readonly snapshots: ReleaseBuildSourceSnapshotService,
  ) { super(); }

  async execute(input: ReleaseBuildExecutionInput, signal?: AbortSignal) {
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
    const profileSnapshot = buildSourcePolicySnapshot(profile);
    const identity: ReleaseBuildWorkerIdentity = {
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
      profileSnapshotHash: sourcePolicySnapshotHash(profileSnapshot),
      deadline: new Date(Date.now() + this.runtime.runTimeoutMs).toISOString(),
    };
    this.jobs.set(input.buildRunId, identity);
    await writeImmutableWorkerJson(inputDirectory, "request.json", signWorkerRequest({
      version: 1,
      identity,
      components: input.components,
      sourceManifest: archive.manifest,
    }, secret), this.runtime.workerSharedGid);
    return this.awaitResult(identity, secret, signal);
  }

  async discardArtifact(input: { buildRunId: string }) {
    const identity = this.jobs.get(input.buildRunId);
    if (!identity) return;
    const secret = await readReleaseBuildWorkerSecret(this.runtime.workerSecretFile);
    await this.cancel(identity, secret, "canceled");
  }

  private async awaitResult(
    identity: ReleaseBuildWorkerIdentity,
    secret: string,
    signal?: AbortSignal,
  ): Promise<ReleaseBuildExecutionResult> {
    while (Date.now() <= new Date(identity.deadline).getTime()) {
      if (signal?.aborted) {
        await this.cancel(identity, secret, "canceled");
        throw releaseBuildExecutionFailure(
          "BUILD_COMMAND_CANCELED", "隔离 Build Worker 已取消", [], "可重新构建。", "canceled",
        );
      }
      const result = await this.readResult(identity).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      });
      if (result) {
        if (!verifyWorkerResult(result, secret) ||
          !sameWorkerIdentity(result.identity, identity)) {
          throw workerFailure("UNTRUSTED_WORKER_ATTESTATION_INVALID");
        }
        if (result.status === "succeeded" && result.result) return result.result;
        if (result.failure) throw new ReleaseBuildExecutionError(result.failure);
        throw workerFailure(result.error?.code || "UNTRUSTED_WORKER_FAILED");
      }
      await delay(this.runtime.workerPollIntervalMs);
    }
    await this.cancel(identity, secret, "timeout");
    throw workerFailure("UNTRUSTED_WORKER_TIMEOUT");
  }

  private async readResult(identity: ReleaseBuildWorkerIdentity) {
    const directory = await workerJobDirectory(
      this.runtime.workerOutputRoot,
      identity.jobId,
      false,
      this.runtime.workerSharedGid,
    );
    return readImmutableWorkerJson<ReleaseBuildWorkerResult>(
      join(directory, "result.json"),
    );
  }

  private async cancel(
    identity: ReleaseBuildWorkerIdentity,
    secret: string,
    reason: "canceled" | "timeout",
  ) {
    const directory = await workerJobDirectory(
      this.runtime.workerInputRoot,
      identity.jobId,
      false,
      this.runtime.workerSharedGid,
    );
    await writeImmutableWorkerJson(directory, "cancel.json", signWorkerCancellation({
      version: 1, identity, reason, requestedAt: new Date().toISOString(),
    }, secret), this.runtime.workerSharedGid).catch(() => undefined);
  }
}

function sourceEnvironment(path: string) {
  return controlledBuildEnvironment(path, "/nonexistent", "/tmp");
}
function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function workerFailure(code: string) {
  return releaseBuildExecutionFailure(code, "隔离 Build Worker 未返回可信结果", [], "检查 Worker 状态后重试。");
}
