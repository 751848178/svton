import { ConfigService } from "@nestjs/config";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { runReleaseBuildBrokerProcess } from "./release-build-broker-process";
import { runExternalOciBroker } from "./release-build-external-oci-runner";
import { promoteBrokerArtifacts } from "./release-build-broker-artifact-promoter";
import { releaseBuildFailureDetail } from "./release-build-failure.utils";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { prepareWorkerBuild,
  prepareWorkerBrokerRoots,
  materializeWorkerDependency } from "./release-build-worker-preparation";
import { supervisorGateSummary } from "./release-build-supervisor-result.presenter";
import { watchSupervisorCancellation } from "./release-build-supervisor-cancellation";
import { signWorkerResult, verifyWorkerRequest,
  type ReleaseBuildWorkerRequest } from "./release-build-worker-envelope.policy";
import {
  readImmutableWorkerJson,
  workerJobDirectory,
  writeImmutableWorkerJson,
} from "./release-build-worker-exchange";
import { createBrokerJobLayout } from "./release-build-worker-job-layout";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";
import { hashWorkerFile } from "./release-build-worker-source-archive";
import { verifyExtractedWorkerSource } from "./release-build-worker-source-manifest";
import { publishWorkerDependencyReady } from "./release-build-worker-dependency-ready";
import { buildSourcePolicySnapshot,
  sourcePolicySnapshotHash } from "./source-policy-snapshot.policy";
export type FilesystemWorkerConfig = {
  inputRoot: string; outputRoot: string; workRoot: string; secretFile: string;
  commandPath: string; tarExecutable: string; commandTimeoutMs: number;
  cancelGraceMs: number; brokerUid: number; brokerGid: number;
  externalOci?: { image: string; dockerExecutable: string; launcherLabel: string;
    dependencyNetworkMode: "docker-desktop-engine-proxy-v1" | "direct-public-dns-v1";
    engineEvidenceDigest: string };
};
export class ReleaseBuildFilesystemWorker {
  constructor(private readonly config: FilesystemWorkerConfig) {}
  async runJob(jobId: string, shutdownSignal?: AbortSignal) {
    const inputDirectory = await workerJobDirectory(this.config.inputRoot, jobId, false);
    const request = await readImmutableWorkerJson<ReleaseBuildWorkerRequest>(
      join(inputDirectory, "request.json"),
    );
    const profile = await this.assertRequest(request, jobId);
    const outputDirectory = await workerJobDirectory(this.config.outputRoot, jobId, true);
    if (await exists(join(outputDirectory, "result.json"))) return;
    const trustedRoot = await this.createTrustedRoot(jobId);
    const cancellation = watchSupervisorCancellation({
      inputDirectory, secretFile: this.config.secretFile, request,
    });
    const signal = combineSignals(cancellation.signal, shutdownSignal);
    let broker: Awaited<ReturnType<typeof createBrokerJobLayout>> | undefined;
    let dependencyStore: { fetchRunId: string; cacheGeneration: number;
      combinationHash: string; storeDigest: string } | undefined;
    try {
      const sourceRoot = await this.extractAndVerify(inputDirectory, trustedRoot, request);
      const prepared = await prepareWorkerBuild({ request, profile, sourceRoot,
        trustedRoot, config: this.config, signal });
      const scanned = prepared.scanned;
      dependencyStore = prepared.dependencyStore;
      await publishWorkerDependencyReady({ outputDirectory, secretFile: this.config.secretFile, request, dependencyStore });
      broker = await createBrokerJobLayout({
        root: join(this.config.workRoot, "broker-jobs"),
        buildRunId: request.identity.buildRunId,
        uid: this.config.brokerUid,
        gid: this.config.brokerGid,
        externalOci: Boolean(this.config.externalOci),
      });
      const { buildRoot, dependencyStoreRoot } = await prepareWorkerBrokerRoots({
        prepared, broker, uid: this.config.brokerUid, gid: this.config.brokerGid,
        immutable: Boolean(this.config.externalOci),
      });
      const brokerInput: Parameters<typeof runReleaseBuildBrokerProcess>[0] = {
        broker: {
          version: 1, request: materializeWorkerDependency(
            request, dependencyStore.storeDigest), jobRoot: broker.jobRoot,
          workRoot: broker.workRoot, buildRoot, dependencyStoreRoot,
          artifactRoot: broker.artifactRoot,
          supplyProofFile: join(broker.jobRoot, "control", "supply-proof.json"),
          commandPath: this.config.commandPath,
          commandTimeoutMs: this.config.commandTimeoutMs,
          cancelGraceMs: this.config.cancelGraceMs,
          prepared: {
            security: scanned.prepared.security,
            sourceSnapshot: scanned.prepared.sourceSnapshot,
          },
        },
        supplyProof: expectedReleaseBuildSupplyProof(profile),
        brokerUid: this.config.brokerUid, brokerGid: this.config.brokerGid,
        timeoutMs: this.config.commandTimeoutMs,
        signal,
      };
      const brokerResult = this.config.externalOci
        ? await runExternalOciBroker({ ...brokerInput,
          image: this.config.externalOci.image,
          dockerExecutable: this.config.externalOci.dockerExecutable,
          launcherLabel: this.config.externalOci.launcherLabel })
        : await this.runTrustedTestBroker(brokerInput);
      if (brokerResult.status !== "succeeded" || !brokerResult.result) {
        throw brokerResult.failure ?? new Error("broker failed");
      }
      await promoteBrokerArtifacts({
        rawRoot: broker.artifactRoot, trustedRoot: scanned.artifactRoot,
        finalRoot: join(this.config.outputRoot, "artifacts"),
        projectId: request.identity.projectId,
        releaseOrderId: request.identity.releaseOrderId,
        buildRunId: request.identity.buildRunId,
        result: brokerResult.result,
      });
      await this.writeResult(outputDirectory, request, "succeeded", {
        ...brokerResult.result,
        gateSummary: supervisorGateSummary(
          brokerResult.result.gateSummary,
          scanned.prepared,
          expectedReleaseBuildSupplyProof(profile).supplyChainDigest,
          Boolean(this.config.externalOci),
          { fetchRunId: dependencyStore.fetchRunId,
            cacheGeneration: dependencyStore.cacheGeneration,
            storeDigest: dependencyStore.storeDigest },
        ),
      }, undefined, dependencyStore);
    } catch (error) {
      const failure = releaseBuildFailureDetail(error, signal);
      await this.writeResult(
        outputDirectory, request,
        failure.status === "canceled" ? "canceled" : "failed",
        undefined, failure, dependencyStore,
      );
    } finally {
      await broker?.cleanup();
      cancellation.stop();
      await rm(trustedRoot, { recursive: true, force: true });
    }
  }
  private async assertRequest(request: ReleaseBuildWorkerRequest, jobId: string) {
    const secret = await readReleaseBuildWorkerSecret(this.config.secretFile);
    const profile = resolveRegisteredReleaseBuildProfile(request.identity.profileId);
    if (request.version !== 1 || request.identity.jobId !== jobId ||
      !verifyWorkerRequest(request, secret) || !profile ||
      profile.profileVersion !== request.identity.profileVersion ||
      sourcePolicySnapshotHash(buildSourcePolicySnapshot(profile)) !==
        request.identity.profileSnapshotHash ||
      request.sourceManifest.digest !== request.identity.sourceManifestDigest ||
      (this.config.externalOci &&
        (request.identity.dependency.dependencyNetworkMode !== this.config.externalOci.dependencyNetworkMode ||
         request.identity.dependency.engineEvidenceDigest !== this.config.externalOci.engineEvidenceDigest)) ||
      new Date(request.identity.deadline).getTime() <= Date.now()) {
      throw new Error("Release Build worker request attestation is invalid");
    }
    return profile;
  }
  private runTrustedTestBroker(
    input: Parameters<typeof runReleaseBuildBrokerProcess>[0],
  ) {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("same-process UID broker is restricted to trusted tests");
    }
    return runReleaseBuildBrokerProcess(input);
  }
  private async writeResult(directory: string, request: ReleaseBuildWorkerRequest,
    status: "succeeded" | "failed" | "canceled", result?: unknown, failure?: unknown,
    dependencyStore?: { fetchRunId: string; cacheGeneration: number;
      combinationHash: string; storeDigest: string }) {
    const secret = await readReleaseBuildWorkerSecret(this.config.secretFile);
    await writeImmutableWorkerJson(directory, "result.json", signWorkerResult({
      version: 1, identity: request.identity, status,
      ...(result ? { result: result as never } : {}),
      ...(failure ? { failure: failure as never } : {}),
      ...(dependencyStore ? { dependencyStore } : {}),
    }, secret));
  }
  private async createTrustedRoot(jobId: string) {
    const root = join(this.config.workRoot, "supervisor");
    await mkdir(root, { recursive: true, mode: 0o700 });
    return mkdtemp(join(root, `${jobId}-`));
  }
  private async extractAndVerify(directory: string, root: string,
    request: ReleaseBuildWorkerRequest) {
    const archive = join(directory, "source.tar");
    if (await hashWorkerFile(archive) !== request.identity.sourceArchiveDigest)
      throw new Error("Release Build source archive digest mismatch");
    const source = join(root, "source");
    await mkdir(source, { mode: 0o700 });
    const outcome = await runReleaseBuildArgv({ executable: this.config.tarExecutable,
      args: ["-xf", archive, "-C", source, "--no-same-owner", "--no-same-permissions"],
      cwd: root, env: { PATH: this.config.commandPath, HOME: root, TMPDIR: root },
      timeoutMs: this.config.commandTimeoutMs,
      cancelGraceMs: this.config.cancelGraceMs });
    if (outcome.kind !== "completed" || outcome.exitCode !== 0)
      throw new Error("Release Build source archive extraction failed");
    await verifyExtractedWorkerSource(source, request.sourceManifest);
    return source;
  }
}
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
function combineSignals(first: AbortSignal, second?: AbortSignal) {
  return second ? AbortSignal.any([first, second]) : first;
}
