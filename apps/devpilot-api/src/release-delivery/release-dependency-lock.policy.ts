import { createHash } from "node:crypto";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import type { WorkerSourceManifest } from "./release-build-worker-source-manifest";

export const DEPENDENCY_POLICY_BLOCKED = "dependency_lock_policy_blocked" as const;

export function evaluateReleaseDependencyLock(input: {
  manifest: WorkerSourceManifest;
  bytes: Buffer;
  profile: RegisteredReleaseBuildProfile;
  platformArch: "amd64" | "arm64";
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
  const reason = prohibitedReason(text, input.profile.dependencyStorePolicy.registry);
  if (reason) return blocked(reason);
  const policy = input.profile.dependencyStorePolicy;
  const combinationHash = stableHash({
    scope: policy.contract,
    lockfileDigest: digest,
    profileId: input.profile.id,
    profileVersion: input.profile.profileVersion,
    pnpmVersion: policy.pnpmVersion,
    platformOs: policy.platformOs,
    platformArch: input.platformArch,
    registryPolicyDigest: policy.registryPolicyDigest,
  });
  return { allowed: true as const, lockfilePath: lock.path,
    lockfileDigest: digest, combinationHash,
    fetchRunId: `dep_${combinationHash}` };
}

function prohibitedReason(value: string, registry: string) {
  if (/^\s*(?:_auth|_authToken|auth|password|token|username)\s*:/im.test(value))
    return "dependency_auth_forbidden";
  if (/(?:git\+ssh|git\+https|git|ssh|file|link):/i.test(value))
    return "dependency_protocol_forbidden";
  const urls = Array.from(value.matchAll(/https?:\/\/[^\s,}\]]+/gi),
    (match) => match[0]);
  if (urls.some((url) => !url.startsWith(`${registry}/`)))
    return "dependency_registry_host_forbidden";
  return null;
}

function blocked(detailCode: string) {
  return { allowed: false as const, reasonCode: DEPENDENCY_POLICY_BLOCKED,
    detailCode };
}
