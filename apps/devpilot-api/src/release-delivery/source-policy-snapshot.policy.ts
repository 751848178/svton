import { canonicalJson, stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";

export const SOURCE_POLICY_SNAPSHOT_VERSION = 2 as const;

export type SourcePolicySnapshotV2 = ReturnType<
  typeof buildSourcePolicySnapshot
>;

export function buildSourcePolicySnapshot(
  profile: RegisteredReleaseBuildProfile,
) {
  return {
    schemaVersion: SOURCE_POLICY_SNAPSHOT_VERSION,
    profileId: profile.id,
    profileVersion: profile.profileVersion,
    runnerVersion: profile.runnerVersion,
    workerControls: {
      contractVersion: "release-build-untrusted-worker-v1",
      provider: "external-oci-launcher-v1",
      sourceArchive: "git-archive-exact-commit-v1",
      sourceManifest: "path-mode-size-sha256-v1",
      gitExecutable: "/usr/bin/git",
      tarExecutable: "/bin/tar",
      networkPolicy: "none",
      containerPolicy: "per-job-immutable-oci-v1",
      terminationPolicy: "kill-remove-before-promote",
      packageInstallPolicy: "locked-offline",
    },
    externalRequiredChecks: profile.externalRequiredChecks,
    requiredIndependentApprovals: profile.requiredIndependentApprovals,
    highRiskPathPrefixes: [...new Set(profile.highRiskPathPrefixes)].sort(),
    packageManagers: Object.entries(profile.packageManagers)
      .map(([id, manager]) => ({ id, ...manager }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    supplyChain: {
      schemaVersion: profile.supplyChain.schemaVersion,
      baseImageDigests: [...new Set(profile.supplyChain.baseImageDigests)].sort(),
      artifactDigests: Object.fromEntries(
        Object.entries(profile.supplyChain.artifactDigests)
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    },
    scanners: profile.scanners
      .map((scanner) => ({
        id: scanner.id,
        executable: scanner.executable,
        argvTemplate: [...scanner.argvTemplate],
        toolVersion: scanner.toolVersion,
        rulesDigest: scanner.rulesDigest,
        dataDigest: scanner.dataDigest ?? null,
        dataUpdatedAt: scanner.dataUpdatedAt ?? null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function sourcePolicySnapshotHash(snapshot: SourcePolicySnapshotV2) {
  return stableHash({ scope: "source-policy-v2", snapshot });
}

export function sourcePolicySnapshotsEqual(
  stored: unknown,
  expected: SourcePolicySnapshotV2,
) {
  return canonicalJson(stored) === canonicalJson(expected);
}
