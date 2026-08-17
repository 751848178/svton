import type { ReleaseBuildGateEvidence } from "./release-build-evidence.types";
import { sameWorkerIdentity, signWorkerEnvelope, verifyWorkerEnvelope,
  type ReleaseBuildWorkerIdentity, type ReleaseBuildWorkerRequest,
  type ReleaseBuildWorkerRequestIdentity,
} from "./release-build-worker-envelope.policy";

export type AssignedReleaseBuildWorkerRequest =
  Omit<ReleaseBuildWorkerRequest, "identity"> & { identity: ReleaseBuildWorkerIdentity };

export type ReleaseBuildWorkerScanReady = {
  version: 1;
  identity: ReleaseBuildWorkerRequestIdentity;
  security: Record<string, ReleaseBuildGateEvidence>;
  signature: string;
};

export type ReleaseBuildWorkerDependencyAssignment = {
  version: 1;
  identity: ReleaseBuildWorkerIdentity;
  signature: string;
};

export type ReleaseBuildWorkerDependencyStage = {
  version: 1;
  identity: ReleaseBuildWorkerIdentity;
  stage: "fetch-starting" | "fetch-authorized";
  signature: string;
};

export function signWorkerScanReady(
  unsigned: Omit<ReleaseBuildWorkerScanReady, "signature">,
  secret: string,
) {
  return { ...unsigned,
    signature: signWorkerEnvelope("scan-ready", unsigned, secret) };
}

export function verifyWorkerScanReady(value: ReleaseBuildWorkerScanReady,
  secret: string, expected: ReleaseBuildWorkerRequestIdentity) {
  const { signature, ...unsigned } = value;
  return value.version === 1 && sameWorkerIdentity(value.identity, expected) &&
    verifyWorkerEnvelope(signature, signWorkerEnvelope("scan-ready", unsigned, secret));
}

export function signWorkerDependencyAssignment(
  unsigned: Omit<ReleaseBuildWorkerDependencyAssignment, "signature">,
  secret: string,
) {
  return { ...unsigned,
    signature: signWorkerEnvelope("dependency-assignment", unsigned, secret) };
}

export function verifyWorkerDependencyAssignment(
  value: ReleaseBuildWorkerDependencyAssignment,
  secret: string,
  expected: ReleaseBuildWorkerRequestIdentity,
) {
  const { signature, ...unsigned } = value;
  const { dependency: _dependency, ...identity } = value.identity;
  return value.version === 1 && sameWorkerIdentity(identity, expected) &&
    verifyWorkerEnvelope(signature,
      signWorkerEnvelope("dependency-assignment", unsigned, secret));
}

export function signWorkerDependencyStage(
  unsigned: Omit<ReleaseBuildWorkerDependencyStage, "signature">,
  secret: string,
) {
  return { ...unsigned,
    signature: signWorkerEnvelope(unsigned.stage, unsigned, secret) };
}

export function verifyWorkerDependencyStage(
  value: ReleaseBuildWorkerDependencyStage,
  secret: string,
  expected: ReleaseBuildWorkerIdentity,
  stage: ReleaseBuildWorkerDependencyStage["stage"],
) {
  const { signature, ...unsigned } = value;
  return value.version === 1 && value.stage === stage &&
    sameWorkerIdentity(value.identity, expected) &&
    verifyWorkerEnvelope(signature, signWorkerEnvelope(stage, unsigned, secret));
}
