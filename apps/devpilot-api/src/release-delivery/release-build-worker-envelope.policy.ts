import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "../release-orchestration/utils/release-hash.utils";
import type {
  ReleaseBuildFailure,
  ReleaseBuildExecutionInput,
  ReleaseBuildExecutionResult,
} from "./release-build.types";
import type { WorkerSourceManifest } from "./release-build-worker-source-manifest";
import type { DependencyFetchIdentity } from "./release-dependency-store-contract";

export const RELEASE_BUILD_WORKER_CONTRACT =
  "external-oci-launcher-v1" as const;

export type ReleaseBuildWorkerRequestIdentity = {
  contract: typeof RELEASE_BUILD_WORKER_CONTRACT;
  jobId: string;
  projectId: string;
  releaseOrderId: string;
  buildRunId: string;
  sourceCommitSha: string;
  sourceTreeHash: string;
  sourceSnapshotDigest: string;
  sourceArchiveDigest: string;
  sourceManifestDigest: string;
  profileId: string;
  profileVersion: number;
  profileSnapshotHash: string;
  deadline: string;
};

export type ReleaseBuildWorkerIdentity = ReleaseBuildWorkerRequestIdentity & {
  dependency: DependencyFetchIdentity & {
    mode: "fetch" | "reuse";
    storeDigest: string | null;
  };
};

export type ReleaseBuildWorkerRequest = {
  version: 1;
  identity: ReleaseBuildWorkerRequestIdentity;
  components: ReleaseBuildExecutionInput["components"];
  sourceManifest: WorkerSourceManifest;
  signature: string;
};

export type ReleaseBuildWorkerResult = {
  version: 1;
  identity: ReleaseBuildWorkerRequestIdentity | ReleaseBuildWorkerIdentity;
  status: "succeeded" | "failed" | "canceled";
  result?: ReleaseBuildExecutionResult;
  error?: { code: string; message: string };
  failure?: ReleaseBuildFailure;
  dependencyStore?: { fetchRunId: string; combinationHash: string;
    cacheGeneration: number; storeDigest: string };
  signature: string;
};

export type ReleaseBuildWorkerCancellation = {
  version: 1;
  identity: ReleaseBuildWorkerRequestIdentity;
  reason: "canceled" | "timeout";
  requestedAt: string;
  signature: string;
};

export type ReleaseBuildWorkerDependencyReady = {
  version: 1;
  identity: ReleaseBuildWorkerIdentity;
  dependencyStore: { fetchRunId: string; combinationHash: string;
    cacheGeneration: number; storeDigest: string };
  signature: string;
};

export function signWorkerRequest(
  unsigned: Omit<ReleaseBuildWorkerRequest, "signature">,
  secret: string,
): ReleaseBuildWorkerRequest {
  return { ...unsigned, signature: signWorkerEnvelope("request", unsigned, secret) };
}

export function signWorkerResult(
  unsigned: Omit<ReleaseBuildWorkerResult, "signature">,
  secret: string,
): ReleaseBuildWorkerResult {
  return { ...unsigned, signature: signWorkerEnvelope("result", unsigned, secret) };
}

export function signWorkerCancellation(
  unsigned: Omit<ReleaseBuildWorkerCancellation, "signature">,
  secret: string,
): ReleaseBuildWorkerCancellation {
  return { ...unsigned, signature: signWorkerEnvelope("cancel", unsigned, secret) };
}

export function signWorkerDependencyReady(
  unsigned: Omit<ReleaseBuildWorkerDependencyReady, "signature">,
  secret: string,
): ReleaseBuildWorkerDependencyReady {
  return { ...unsigned, signature: signWorkerEnvelope("dependency-ready", unsigned, secret) };
}

export function verifyWorkerRequest(
  envelope: ReleaseBuildWorkerRequest,
  secret: string,
) {
  const { signature, ...unsigned } = envelope;
  return verifyWorkerEnvelope(signature, signWorkerEnvelope("request", unsigned, secret));
}

export function verifyWorkerResult(
  envelope: ReleaseBuildWorkerResult,
  secret: string,
) {
  const { signature, ...unsigned } = envelope;
  return verifyWorkerEnvelope(signature, signWorkerEnvelope("result", unsigned, secret));
}

export function verifyWorkerCancellation(
  envelope: ReleaseBuildWorkerCancellation,
  secret: string,
) {
  const { signature, ...unsigned } = envelope;
  return verifyWorkerEnvelope(signature, signWorkerEnvelope("cancel", unsigned, secret));
}

export function verifyWorkerDependencyReady(
  envelope: ReleaseBuildWorkerDependencyReady,
  secret: string,
) {
  const { signature, ...unsigned } = envelope;
  return verifyWorkerEnvelope(signature,
    signWorkerEnvelope("dependency-ready", unsigned, secret));
}

export function sameWorkerIdentity(
  left: ReleaseBuildWorkerRequestIdentity | ReleaseBuildWorkerIdentity,
  right: ReleaseBuildWorkerRequestIdentity | ReleaseBuildWorkerIdentity,
) {
  return canonicalJson(left) === canonicalJson(right);
}

export function signWorkerEnvelope(role: string, value: unknown, secret: string) {
  const key = hkdfSync(
    "sha256",
    Buffer.from(secret),
    Buffer.from(RELEASE_BUILD_WORKER_CONTRACT),
    Buffer.from(`release-build-worker:${role}`),
    32,
  );
  return createHmac("sha256", Buffer.from(key))
    .update(`${RELEASE_BUILD_WORKER_CONTRACT}:${role}:`)
    .update(canonicalJson(value))
    .digest("hex");
}

export function verifyWorkerEnvelope(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
