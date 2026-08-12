import { join } from "node:path";
import { prepareWorkerDependencyStore } from "./release-dependency-worker-store";
import { scanSupervisorSource } from "./release-build-supervisor-security";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import type { ReleaseBuildWorkerRequest } from "./release-build-worker-envelope.policy";
import type { AssignedReleaseBuildWorkerRequest } from "./release-build-worker-stage-envelope.policy";
import { transferBuildWorkspace,
  transferDependencyStore } from "./release-build-worker-job-layout";

export async function prepareWorkerScan(input: {
  request: ReleaseBuildWorkerRequest; profile: RegisteredReleaseBuildProfile;
  sourceRoot: string; trustedRoot: string; config: {
    workRoot: string; commandPath: string; commandTimeoutMs: number;
    cancelGraceMs: number; externalOci?: {
      image: string; dockerExecutable: string; launcherLabel: string;
      dependencyNetworkMode: "docker-desktop-engine-proxy-v1" | "direct-public-dns-v1";
      engineEvidenceDigest: string;
    };
  };
  signal?: AbortSignal;
}) {
  const scanned = await scanSupervisorSource({
    request: input.request, profile: input.profile, sourceRoot: input.sourceRoot,
    trustedRoot: input.trustedRoot, commandPath: input.config.commandPath,
    commandTimeoutMs: input.config.commandTimeoutMs,
    cancelGraceMs: input.config.cancelGraceMs, signal: input.signal,
  });
  return scanned;
}

export async function prepareWorkerDependency(input: {
  request: AssignedReleaseBuildWorkerRequest; profile: RegisteredReleaseBuildProfile;
  sourceRoot: string; trustedRoot: string; config: {
    workRoot: string; commandPath: string; commandTimeoutMs: number;
    cancelGraceMs: number; externalOci?: {
      image: string; dockerExecutable: string; launcherLabel: string;
      dependencyNetworkMode: "docker-desktop-engine-proxy-v1" | "direct-public-dns-v1";
      engineEvidenceDigest: string;
    };
  };
  signal?: AbortSignal;
}) {
  const dependency = await prepareWorkerDependencyStore({
    request: input.request, profile: input.profile, sourceRoot: input.sourceRoot,
    cacheRoot: join(input.config.workRoot, "dependency-stores"),
    jobRoot: input.trustedRoot, externalOci: input.config.externalOci,
    timeoutMs: input.config.commandTimeoutMs, signal: input.signal,
  });
  return { dependency, dependencyStore: {
    fetchRunId: input.request.identity.dependency.fetchRunId,
    cacheGeneration: input.request.identity.dependency.cacheGeneration,
    combinationHash: input.request.identity.dependency.combinationHash,
    storeDigest: dependency.manifest.storeDigest,
  } };
}

export async function prepareWorkerBrokerRoots(input: {
  scanned: Awaited<ReturnType<typeof prepareWorkerScan>>;
  dependency: Awaited<ReturnType<typeof prepareWorkerDependency>>;
  broker: { jobRoot: string; workRoot: string };
  uid: number; gid: number; immutable: boolean;
}) {
  const buildRoot = await transferBuildWorkspace({
    source: input.scanned.prepared.buildRoot,
    workRoot: input.broker.workRoot, uid: input.uid, gid: input.gid,
    immutable: input.immutable,
  });
  const dependencyStoreRoot = await transferDependencyStore({
    source: input.dependency.dependency.root, jobRoot: input.broker.jobRoot,
    combinationHash: input.dependency.dependencyStore.combinationHash,
    storeDigest: input.dependency.dependencyStore.storeDigest,
  });
  return { buildRoot, dependencyStoreRoot };
}

export function materializeWorkerDependency(
  request: AssignedReleaseBuildWorkerRequest,
  storeDigest: string,
) {
  const { signature: _signature, ...unsigned } = request;
  return { ...unsigned, identity: { ...unsigned.identity, dependency: {
    ...unsigned.identity.dependency, storeDigest,
  } } };
}
