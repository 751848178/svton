import { stableHash } from "../release-orchestration/utils/release-hash.utils";

export type ReleaseDependencyStoreFile = {
  path: string; sizeBytes: number; sha256: string;
};
export type ReleaseDependencyStoreManifest = {
  schemaVersion: 1;
  combinationHash: string;
  lockfileDigest: string;
  profileId: string;
  profileVersion: number;
  profileSnapshotHash: string;
  supplyChainDigest: string;
  fetchImage: string;
  jobImage: string;
  pnpmVersion: string;
  platformOs: string;
  platformArch: string;
  platformAbi: string;
  platformLibc: string;
  registryPolicyDigest: string;
  dependencyNetworkMode:
    "docker-desktop-engine-proxy-v1" | "direct-public-dns-v1";
  engineEvidenceDigest: string;
  files: ReleaseDependencyStoreFile[];
  storeDigest: string;
};

export function dependencyStoreManifest(input: Omit<
  ReleaseDependencyStoreManifest, "schemaVersion" | "storeDigest"
>): ReleaseDependencyStoreManifest {
  const value = { schemaVersion: 1 as const, ...input,
    files: [...input.files].sort((left, right) => left.path.localeCompare(right.path)) };
  return { ...value, storeDigest: stableHash({
    scope: "release-dependency-store-manifest-v1", ...value,
  }) };
}

export function validDependencyStoreManifest(value: unknown):
  value is ReleaseDependencyStoreManifest {
  if (!record(value) || value.schemaVersion !== 1 ||
    !hex(value.combinationHash) || !hex(value.lockfileDigest) ||
    !hex(value.registryPolicyDigest) || !hex(value.engineEvidenceDigest) ||
    !hex(value.storeDigest) ||
    !hex(value.profileSnapshotHash) || !hex(value.supplyChainDigest) ||
    typeof value.fetchImage !== "string" || !value.fetchImage.includes("@sha256:") ||
    typeof value.jobImage !== "string" || !value.jobImage.includes("@sha256:") ||
    typeof value.profileId !== "string" ||
    !["docker-desktop-engine-proxy-v1", "direct-public-dns-v1"]
      .includes(value.dependencyNetworkMode) ||
    !Number.isInteger(value.profileVersion) || typeof value.pnpmVersion !== "string" ||
    value.platformOs !== "linux" || !["amd64", "arm64"].includes(String(value.platformArch)) ||
    typeof value.platformAbi !== "string" || typeof value.platformLibc !== "string" ||
    !Array.isArray(value.files)) return false;
  if (!value.files.every((file) => record(file) && safePath(file.path) &&
    Number.isInteger(file.sizeBytes) && Number(file.sizeBytes) >= 0 && hex(file.sha256)))
    return false;
  const rebuilt = dependencyStoreManifest({
    combinationHash: value.combinationHash as string,
    lockfileDigest: value.lockfileDigest as string,
    profileId: value.profileId, profileVersion: value.profileVersion as number,
    profileSnapshotHash: value.profileSnapshotHash as string,
    supplyChainDigest: value.supplyChainDigest as string,
    fetchImage: value.fetchImage as string, jobImage: value.jobImage as string,
    pnpmVersion: value.pnpmVersion, platformOs: value.platformOs,
    platformArch: value.platformArch as string,
    platformAbi: value.platformAbi as string, platformLibc: value.platformLibc as string,
    registryPolicyDigest: value.registryPolicyDigest as string,
    dependencyNetworkMode: value.dependencyNetworkMode,
    engineEvidenceDigest: value.engineEvidenceDigest as string,
    files: value.files as ReleaseDependencyStoreFile[],
  });
  return rebuilt.storeDigest === value.storeDigest;
}

function record(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function hex(value: unknown) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function safePath(value: unknown) {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/") &&
    value.split("/").every((part) => part && part !== ".." && part !== ".");
}
