import { ConfigService } from "@nestjs/config";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { executeAssignedWorkerBuild } from "./release-build-worker-broker-execution";
import { releaseBuildFailureDetail } from "./release-build-failure.utils";
import { promoteSupervisorEvidence } from "./release-build-supervisor-evidence-promoter";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { prepareWorkerScan, prepareWorkerDependency,
} from "./release-build-worker-preparation";
import { supervisorGateSummary } from "./release-build-supervisor-result.presenter";
import { watchSupervisorCancellation } from "./release-build-supervisor-cancellation";
import { signWorkerResult, verifyWorkerRequest,
  type ReleaseBuildWorkerRequest } from "./release-build-worker-envelope.policy";
import {
  readImmutableWorkerJson,
  workerJobDirectory,
  writeImmutableWorkerJson,
} from "./release-build-worker-exchange";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";
import { extractAndVerifyWorkerSource } from "./release-build-worker-source-extractor";
import { publishWorkerDependencyReady } from "./release-build-worker-dependency-ready";
import { publishWorkerDependencyStage, publishWorkerScanReady,
  waitForWorkerDependencyAssignment, waitForWorkerFetchAuthorization,
} from "./release-build-worker-stage-exchange";
import { verifyWorkerDependencyAssignment, verifyWorkerDependencyStage,
  type AssignedReleaseBuildWorkerRequest,
} from "./release-build-worker-stage-envelope.policy";
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
    let evidencePromoted = false;
    let assigned: AssignedReleaseBuildWorkerRequest | undefined;
    let dependencyStore: { fetchRunId: string; cacheGeneration: number;
      combinationHash: string; storeDigest: string } | undefined;
    try {
      const sourceRoot = await extractAndVerifyWorkerSource({ directory: inputDirectory,
        root: trustedRoot, request, tarExecutable: this.config.tarExecutable,
        commandPath: this.config.commandPath, timeoutMs: this.config.commandTimeoutMs,
        cancelGraceMs: this.config.cancelGraceMs });
      const scanned = await prepareWorkerScan({ request, profile, sourceRoot,
        trustedRoot, config: this.config, signal });
      await this.promoteEvidence(trustedRoot, request);
      evidencePromoted = true;
      await publishWorkerScanReady({ outputDirectory,
        secretFile: this.config.secretFile, request,
        security: scanned.prepared.security });
      const secret = await readReleaseBuildWorkerSecret(this.config.secretFile);
      const assignment = await waitForWorkerDependencyAssignment({
        inputDirectory, request, signal });
      if (!verifyWorkerDependencyAssignment(assignment, secret, request.identity) ||
        !this.validDependencyNetwork(assignment.identity))
        throw new Error("Signed dependency assignment is invalid");
      assigned = { ...request, identity: assignment.identity };
      if (assignment.identity.dependency.mode === "fetch") {
        await publishWorkerDependencyStage({ directory: outputDirectory,
          filename: "fetch-starting.json", identity: assignment.identity,
          stage: "fetch-starting", secret });
        const authorization = await waitForWorkerFetchAuthorization({
          inputDirectory, identity: assignment.identity, signal });
        if (!verifyWorkerDependencyStage(authorization, secret,
          assignment.identity, "fetch-authorized"))
          throw new Error("Signed dependency fetch authorization is invalid");
      }
      const preparedDependency = await prepareWorkerDependency({ request: assigned,
        profile, sourceRoot, trustedRoot, config: this.config, signal });
      dependencyStore = preparedDependency.dependencyStore;
      await publishWorkerDependencyReady({ outputDirectory,
        secretFile: this.config.secretFile, request: assigned, dependencyStore });
      const buildResult = await executeAssignedWorkerBuild({ request: assigned,
        profile, scanned, dependency: preparedDependency, dependencyStore,
        config: this.config, signal });
      await this.writeResult(outputDirectory, assigned.identity, "succeeded", {
        ...buildResult,
        gateSummary: supervisorGateSummary(
          buildResult.gateSummary,
          scanned.prepared,
          expectedReleaseBuildSupplyProof(profile).supplyChainDigest,
          Boolean(this.config.externalOci),
          { fetchRunId: dependencyStore.fetchRunId,
            cacheGeneration: dependencyStore.cacheGeneration,
            storeDigest: dependencyStore.storeDigest },
        ),
      }, undefined, dependencyStore);
    } catch (error) {
      let failureSource = error;
      if (!evidencePromoted) {
        try { await this.promoteEvidence(trustedRoot, request); }
        catch (promotionError) { failureSource = promotionError; }
      }
      const failure = releaseBuildFailureDetail(failureSource, signal);
      await this.writeResult(
        outputDirectory, assigned?.identity ?? request.identity,
        failure.status === "canceled" ? "canceled" : "failed",
        undefined, failure, dependencyStore,
      );
    } finally {
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
      new Date(request.identity.deadline).getTime() <= Date.now()) {
      throw new Error("Release Build worker request attestation is invalid");
    }
    return profile;
  }
  private async writeResult(directory: string,
    identity: ReleaseBuildWorkerRequest["identity"] | AssignedReleaseBuildWorkerRequest["identity"],
    status: "succeeded" | "failed" | "canceled", result?: unknown, failure?: unknown,
    dependencyStore?: { fetchRunId: string; cacheGeneration: number;
      combinationHash: string; storeDigest: string }) {
    const secret = await readReleaseBuildWorkerSecret(this.config.secretFile);
    await writeImmutableWorkerJson(directory, "result.json", signWorkerResult({
      version: 1, identity, status,
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
  private promoteEvidence(root: string, request: ReleaseBuildWorkerRequest) {
    return promoteSupervisorEvidence({ trustedRoot: root,
      outputRoot: this.config.outputRoot,
      projectId: request.identity.projectId,
      releaseOrderId: request.identity.releaseOrderId,
      buildRunId: request.identity.buildRunId });
  }
  private validDependencyNetwork(identity: AssignedReleaseBuildWorkerRequest["identity"]) {
    return !this.config.externalOci ||
      (identity.dependency.dependencyNetworkMode ===
        this.config.externalOci.dependencyNetworkMode &&
       identity.dependency.engineEvidenceDigest ===
        this.config.externalOci.engineEvidenceDigest);
  }
}
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
function combineSignals(first: AbortSignal, second?: AbortSignal) {
  return second ? AbortSignal.any([first, second]) : first;
}
