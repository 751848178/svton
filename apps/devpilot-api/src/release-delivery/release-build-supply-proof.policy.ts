import { constants, closeSync, fstatSync, openSync, readFileSync } from "node:fs";
import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";

export type ReleaseBuildSupplyProof = {
  schemaVersion: 1;
  profileId: string;
  profileVersion: number;
  supplyChainDigest: string;
};

export function expectedReleaseBuildSupplyProof(
  profile: RegisteredReleaseBuildProfile,
): ReleaseBuildSupplyProof {
  return {
    schemaVersion: 1,
    profileId: profile.id,
    profileVersion: profile.profileVersion,
    supplyChainDigest: stableHash({
      scope: "release-build-supply-chain-v1",
      profileId: profile.id,
      profileVersion: profile.profileVersion,
      runnerVersion: profile.runnerVersion,
      packageManagers: profile.packageManagers,
      scanners: profile.scanners,
      supplyChain: profile.supplyChain,
    }),
  };
}

export function verifyReleaseBuildSupplyProof(
  path: string | undefined,
  profile: RegisteredReleaseBuildProfile | null,
) {
  if (!path || !profile) return false;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > 4096 || (stat.mode & 0o022) !== 0) return false;
    const value = JSON.parse(readFileSync(descriptor, "utf8")) as unknown;
    const expected = expectedReleaseBuildSupplyProof(profile);
    const row = record(value);
    return row?.schemaVersion === expected.schemaVersion &&
      row.profileId === expected.profileId &&
      row.profileVersion === expected.profileVersion &&
      row.supplyChainDigest === expected.supplyChainDigest;
  } catch {
    return false;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
