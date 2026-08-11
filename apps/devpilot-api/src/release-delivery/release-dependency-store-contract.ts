export const RELEASE_DEPENDENCY_STORE_CONTRACT =
  "lockfile-bound-dependency-store-v1" as const;

export type DependencyFetchIdentity = {
  fetchRunId: string;
  combinationHash: string;
  lockfileDigest: string;
  profileId: string;
  profileVersion: number;
  profileSnapshotHash: string;
  supplyChainDigest: string;
  fetchImage: string;
  jobImage: string;
  pnpmVersion: string;
  platformOs: "linux";
  platformArch: "amd64" | "arm64";
  platformAbi: string;
  platformLibc: string;
  registryPolicyDigest: string;
};
