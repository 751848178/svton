import { createHash } from "node:crypto";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import type { WorkerSourceManifest } from "./release-build-worker-source-manifest";
import { validateDependencyLockAst } from "./release-dependency-lock-ast.policy";
import { buildSourcePolicySnapshot, sourcePolicySnapshotHash } from "./source-policy-snapshot.policy";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";

export const DEPENDENCY_POLICY_BLOCKED = "dependency_lock_policy_blocked" as const;

export function evaluateReleaseDependencyLock(input: {
  manifest: WorkerSourceManifest;
  bytes: Buffer;
  profile: RegisteredReleaseBuildProfile;
  platformArch: "amd64" | "arm64";
  jobImage: string;
  dependencyNetworkMode: "docker-desktop-engine-proxy-v1" | "direct-public-dns-v1";
  engineEvidenceDigest: string;
}) {
  const npmrc = input.manifest.entries.some((entry) =>
    entry.path.split("/").at(-1)?.toLowerCase() === ".npmrc");
  const locks = input.manifest.entries.filter((entry) =>
    entry.path.split("/").at(-1)?.toLowerCase() === "pnpm-lock.yaml");
  if (npmrc || locks.length !== 1) return blocked(npmrc ? "project_npmrc_forbidden" :
    "exactly_one_pnpm_lock_required");
  const lock = locks[0];
  const digest = createHash("sha256").update(input.bytes).digest("hex");
  if (lock.mode === "120000" || lock.sizeBytes !== input.bytes.byteLength ||
    lock.sha256 !== digest || input.bytes.byteLength > 10 * 1024 * 1024) {
    return blocked("signed_lockfile_identity_invalid");
  }
  const text = input.bytes.toString("utf8");
  if (Buffer.from(text).compare(input.bytes) !== 0 || text.includes("\0"))
    return blocked("lockfile_encoding_invalid");
  const reason = validateDependencyLockAst(input.bytes,
    input.profile.dependencyStorePolicy.registry);
  if (reason) return blocked(reason);
  const policy = input.profile.dependencyStorePolicy;
  const profileSnapshotHash = sourcePolicySnapshotHash(
    buildSourcePolicySnapshot(input.profile));
  const supplyChainDigest = expectedReleaseBuildSupplyProof(
    input.profile).supplyChainDigest;
  const combinationHash = stableHash({
    scope: policy.contract,
    lockfileDigest: digest,
    profileId: input.profile.id,
    profileVersion: input.profile.profileVersion,
    profileSnapshotHash,
    supplyChainDigest,
    fetchImage: input.jobImage,
    jobImage: input.jobImage,
    pnpmVersion: policy.pnpmVersion,
    platformOs: policy.platformOs,
    platformArch: input.platformArch,
    platformAbi: policy.platformAbi,
    platformLibc: policy.platformLibc,
    registryPolicyDigest: policy.registryPolicyDigest,
    dependencyNetworkMode: input.dependencyNetworkMode,
    engineEvidenceDigest: input.engineEvidenceDigest,
  });
  return { allowed: true as const, lockfilePath: lock.path,
    lockfileDigest: digest, combinationHash, profileSnapshotHash,
    supplyChainDigest, sanitizedLockfile: Buffer.from(input.bytes),
    fetchRunId: `dep_${combinationHash}` };
}

function blocked(detailCode: string) {
  return { allowed: false as const, reasonCode: DEPENDENCY_POLICY_BLOCKED,
    detailCode };
}
