import { ConfigService } from "@nestjs/config";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { LocalReleaseBuildExecutorService } from "./local-release-build-executor.service";
import { LocalReleaseEvidenceArtifactService } from "./local-release-evidence-artifact.service";
import { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import { ReleaseBuildPackageEvidenceService } from "./release-build-package-evidence.service";
import { ReleaseBuildPreScriptSecurityService } from "./release-build-pre-script-security.service";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseBuildScannerEvidenceService } from "./release-build-scanner-evidence.service";
import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import { releaseBuildFailureDetail } from "./release-build-failure.utils";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import {
  sameWorkerIdentity,
  signWorkerResult,
  verifyWorkerCancellation,
  verifyWorkerRequest,
  type ReleaseBuildWorkerCancellation,
  type ReleaseBuildWorkerRequest,
} from "./release-build-worker-envelope.policy";
import {
  readImmutableWorkerJson,
  workerJobDirectory,
  writeImmutableWorkerJson,
} from "./release-build-worker-exchange";
import { ReleaseBuildWorkerExtractedSnapshotService } from "./release-build-worker-extracted-snapshot.service";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";
import { hashWorkerFile } from "./release-build-worker-source-archive";
import { verifyExtractedWorkerSource } from "./release-build-worker-source-manifest";
import {
  buildSourcePolicySnapshot,
  sourcePolicySnapshotHash,
} from "./source-policy-snapshot.policy";

export type FilesystemWorkerConfig = {
  inputRoot: string;
  outputRoot: string;
  workRoot: string;
  secretFile: string;
  commandPath: string;
  tarExecutable: string;
  commandTimeoutMs: number;
  cancelGraceMs: number;
};

export class ReleaseBuildFilesystemWorker {
  constructor(private readonly config: FilesystemWorkerConfig) {}

  async runJob(jobId: string) {
    const inputDirectory = await workerJobDirectory(this.config.inputRoot, jobId, false);
    const request = await readImmutableWorkerJson<ReleaseBuildWorkerRequest>(
      join(inputDirectory, "request.json"),
    );
    const secret = await readReleaseBuildWorkerSecret(this.config.secretFile);
    this.assertRequest(request, secret, jobId);
    const outputDirectory = await workerJobDirectory(this.config.outputRoot, jobId, true);
    if (await exists(join(outputDirectory, "result.json"))) return;
    const jobRoot = await this.createJobRoot(jobId);
    const controller = new AbortController();
    const cancelTimer = setInterval(
      () => void this.applyCancellation(inputDirectory, request, secret, controller),
      200,
    );
    try {
      const sourceRoot = await this.extractAndVerify(inputDirectory, jobRoot, request);
      const executor = this.executor(request, sourceRoot, jobRoot);
      const result = await executor.execute({
        buildRunId: request.identity.buildRunId,
        projectId: request.identity.projectId,
        releaseOrderId: request.identity.releaseOrderId,
        sourceCommitSha: request.identity.sourceCommitSha,
        checkoutRoot: sourceRoot,
        components: request.components,
      }, controller.signal);
      await writeImmutableWorkerJson(outputDirectory, "result.json", signWorkerResult({
        version: 1, identity: request.identity, status: "succeeded", result,
      }, secret));
    } catch (error) {
      const failure = releaseBuildFailureDetail(error, controller.signal);
      await writeImmutableWorkerJson(outputDirectory, "result.json", signWorkerResult({
        version: 1,
        identity: request.identity,
        status: failure.status === "canceled" ? "canceled" : "failed",
        error: { code: failure.code, message: failure.message },
        failure,
      }, secret));
    } finally {
      clearInterval(cancelTimer);
      await rm(jobRoot, { recursive: true, force: true });
    }
  }

  private assertRequest(
    request: ReleaseBuildWorkerRequest,
    secret: string,
    jobId: string,
  ) {
    const profile = resolveRegisteredReleaseBuildProfile(request.identity.profileId);
    if (
      request.version !== 1 || request.identity.jobId !== jobId ||
      !verifyWorkerRequest(request, secret) || !profile ||
      profile.profileVersion !== request.identity.profileVersion ||
      sourcePolicySnapshotHash(buildSourcePolicySnapshot(profile)) !==
        request.identity.profileSnapshotHash ||
      request.sourceManifest.digest !== request.identity.sourceManifestDigest ||
      new Date(request.identity.deadline).getTime() <= Date.now()
    ) throw new Error("Release Build worker request attestation is invalid");
  }

  private async createJobRoot(jobId: string) {
    await mkdir(this.config.workRoot, { recursive: true, mode: 0o700 });
    return mkdtemp(join(this.config.workRoot, `${jobId}-`));
  }

  private async extractAndVerify(
    inputDirectory: string,
    jobRoot: string,
    request: ReleaseBuildWorkerRequest,
  ) {
    const archive = join(inputDirectory, "source.tar");
    if (await hashWorkerFile(archive) !== request.identity.sourceArchiveDigest) {
      throw new Error("Release Build source archive digest mismatch");
    }
    const sourceRoot = join(jobRoot, "source");
    await mkdir(sourceRoot, { mode: 0o700 });
    const extracted = await runReleaseBuildArgv({
      executable: this.config.tarExecutable,
      args: ["-xf", archive, "-C", sourceRoot, "--no-same-owner", "--no-same-permissions"],
      cwd: jobRoot,
      env: { PATH: this.config.commandPath, HOME: jobRoot, TMPDIR: jobRoot },
      timeoutMs: this.config.commandTimeoutMs,
      cancelGraceMs: this.config.cancelGraceMs,
      maxOutputBytes: 1024 * 1024,
    });
    if (extracted.kind !== "completed" || extracted.exitCode !== 0) {
      throw new Error("Release Build source archive extraction failed");
    }
    await verifyExtractedWorkerSource(sourceRoot, request.sourceManifest);
    return sourceRoot;
  }

  private executor(
    request: ReleaseBuildWorkerRequest,
    sourceRoot: string,
    jobRoot: string,
  ) {
    void sourceRoot;
    const artifactRoot = join(this.config.outputRoot, "artifacts");
    const config = new ConfigService({
      NODE_ENV: "production", RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: request.identity.profileId,
      RELEASE_BUILD_WORKER_PROCESS: true, RELEASE_BUILD_WORK_ROOT: this.config.workRoot,
      RELEASE_BUILD_ARTIFACT_ROOT: artifactRoot,
      RELEASE_BUILD_COMMAND_PATH: this.config.commandPath,
      RELEASE_BUILD_COMMAND_TIMEOUT_MS: this.config.commandTimeoutMs,
      RELEASE_BUILD_CANCEL_GRACE_MS: this.config.cancelGraceMs,
    });
    const runtime = new ReleaseBuildRuntimeProfileService(config);
    const evidence = new LocalReleaseEvidenceArtifactService(config);
    const scanners = new ReleaseBuildScannerEvidenceService(evidence);
    const snapshot = new ReleaseBuildWorkerExtractedSnapshotService(
      request.identity,
      request.sourceManifest,
    );
    const preScript = new ReleaseBuildPreScriptSecurityService(snapshot as never, scanners);
    return new LocalReleaseBuildExecutorService(
      runtime,
      new ReleaseBuildArtifactService(config),
      new ReleaseBuildPackageEvidenceService(evidence),
      preScript,
    );
  }

  private async applyCancellation(
    directory: string,
    request: ReleaseBuildWorkerRequest,
    secret: string,
    controller: AbortController,
  ) {
    try {
      const cancel = await readImmutableWorkerJson<ReleaseBuildWorkerCancellation>(
        join(directory, "cancel.json"),
      );
      if (verifyWorkerCancellation(cancel, secret) &&
        sameWorkerIdentity(cancel.identity, request.identity)) controller.abort(cancel.reason);
    } catch { /* cancellation is optional until its authenticated CAS appears */ }
  }
}

async function exists(path: string) {
  try { await access(path); return true; } catch { return false; }
}
