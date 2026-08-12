import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import type { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import type { ReleaseBuildExecutionInput } from "./release-build.types";
import type { ReleaseDependencyApiCoordinator } from "./release-dependency-api-coordinator.service";
import { isolatedWorkerFailure as workerFailure, publishIsolatedWorkerCancel,
  readIsolatedWorkerResult, workerDelay,
} from "./release-build-isolated-executor.helpers";
import { sameWorkerIdentity, verifyWorkerResult,
  type ReleaseBuildWorkerIdentity,
  type ReleaseBuildWorkerRequestIdentity } from "./release-build-worker-envelope.policy";
import { workerJobDirectory } from "./release-build-worker-exchange";
import { publishWorkerDependencyAssignment, publishWorkerDependencyStage,
  readWorkerDependencyStage, readWorkerScanReady,
} from "./release-build-worker-stage-exchange";
import { verifyWorkerDependencyStage, verifyWorkerScanReady,
} from "./release-build-worker-stage-envelope.policy";
import type { WorkerSourceManifest } from "./release-build-worker-source-manifest";

export async function coordinateWorkerDependency(input: {
  runtime: ReleaseBuildRuntimeProfileService;
  dependencies: ReleaseDependencyApiCoordinator;
  request: ReleaseBuildExecutionInput;
  identity: ReleaseBuildWorkerRequestIdentity;
  manifest: WorkerSourceManifest;
  secret: string;
  signal?: AbortSignal;
  jobImage: string;
  supplyChainDigest: string;
  dependencyNetworkMode:
    "docker-desktop-engine-proxy-v1" | "direct-public-dns-v1";
  engineEvidenceDigest: string;
}) {
  const scan = await waitForScan(input);
  if (!verifyWorkerScanReady(scan, input.secret, input.identity))
    throw workerFailure("UNTRUSTED_SCAN_READY_INVALID");
  const dependency = await input.dependencies.prepare({
    buildRunId: input.request.buildRunId,
    checkoutRoot: input.request.checkoutRoot,
    manifest: input.manifest,
    profileId: input.identity.profileId,
    deadline: new Date(input.identity.deadline),
    profileSnapshotHash: input.identity.profileSnapshotHash,
    supplyChainDigest: input.supplyChainDigest,
    jobImage: input.jobImage,
    dependencyNetworkMode: input.dependencyNetworkMode,
    engineEvidenceDigest: input.engineEvidenceDigest,
  });
  const identity = { ...input.identity, dependency };
  try {
    await publishWorkerDependencyAssignment({ runtime: input.runtime,
      identity, secret: input.secret });
    if (dependency.mode === "fetch") await authorizeFetch(input, identity);
    return identity;
  } catch (error) {
    await input.dependencies.cancel(identity.buildRunId, dependency,
      "dependency_assignment_or_start_failed");
    throw error;
  }
}

async function waitForScan(input: Parameters<typeof coordinateWorkerDependency>[0]) {
  while (Date.now() <= new Date(input.identity.deadline).getTime()) {
    await assertActive(input);
    const result = await readIsolatedWorkerResult(input.runtime, input.identity)
      .catch(missingAsNull);
    if (result) {
      if (!verifyWorkerResult(result, input.secret) ||
        !sameWorkerIdentity(result.identity, input.identity))
        throw workerFailure("UNTRUSTED_WORKER_ATTESTATION_INVALID");
      if (result.failure) throw new ReleaseBuildExecutionError(result.failure);
      throw workerFailure("UNTRUSTED_WORKER_FAILED_BEFORE_SCAN_READY");
    }
    const ready = await readWorkerScanReady(input.runtime, input.identity)
      .catch(missingAsNull);
    if (ready) return ready;
    await workerDelay(input.runtime.workerPollIntervalMs);
  }
  await publishIsolatedWorkerCancel(input.runtime, input.identity,
    input.secret, "timeout");
  throw workerFailure("UNTRUSTED_WORKER_SCAN_TIMEOUT");
}

async function authorizeFetch(input: Parameters<typeof coordinateWorkerDependency>[0],
  identity: ReleaseBuildWorkerIdentity) {
  while (Date.now() <= new Date(identity.deadline).getTime()) {
    await assertActive(input);
    const stage = await readWorkerDependencyStage({ runtime: input.runtime,
      identity, filename: "fetch-starting.json", direction: "output" })
      .catch(missingAsNull);
    if (stage) {
      if (!verifyWorkerDependencyStage(stage, input.secret, identity, "fetch-starting"))
        throw workerFailure("UNTRUSTED_DEPENDENCY_FETCH_START_INVALID");
      await input.dependencies.startFetch(identity.buildRunId, identity.dependency);
      const directory = await workerJobDirectory(input.runtime.workerInputRoot,
        identity.jobId, false, input.runtime.workerSharedGid);
      await publishWorkerDependencyStage({ directory,
        filename: "fetch-authorized.json", identity, stage: "fetch-authorized",
        secret: input.secret, sharedGid: input.runtime.workerSharedGid });
      return;
    }
    await workerDelay(input.runtime.workerPollIntervalMs);
  }
  await publishIsolatedWorkerCancel(input.runtime, input.identity,
    input.secret, "timeout");
  throw workerFailure("DEPENDENCY_FETCH_START_TIMEOUT");
}

async function assertActive(input: Parameters<typeof coordinateWorkerDependency>[0]) {
  if (!input.signal?.aborted) return;
  await publishIsolatedWorkerCancel(input.runtime, input.identity, input.secret, "canceled");
  throw workerFailure("BUILD_COMMAND_CANCELED");
}
function missingAsNull(error: unknown) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
  throw error;
}
