import { stableHash } from "../release-orchestration/utils/release-hash.utils";
import { RELEASE_DEPENDENCY_STORE_CONTRACT } from "./release-dependency-store-contract";

const REGISTRY = "https://registry.npmjs.org";
const PROHIBITED = ["file:", "git:", "git+http:", "git+https:", "http:",
  "https:", "link:", "ssh:"] as const;

export const RELEASE_DEPENDENCY_STORE_POLICY = {
  contract: RELEASE_DEPENDENCY_STORE_CONTRACT,
  packageManager: "pnpm" as const,
  pnpmVersion: "8.12.0",
  platformOs: "linux" as const,
  platformArchitectures: ["amd64", "arm64"] as const,
  platformAbi: "node20-modules-115" as const,
  platformLibc: "glibc-debian-bookworm" as const,
  registry: REGISTRY,
  registryPolicy: "trusted-fetcher-application-allowlist-v1" as const,
  lifecycleScripts: "forbidden" as const,
  projectNpmrc: "forbidden" as const,
  prohibitedProtocols: PROHIBITED,
  fetchImagePolicy: "launcher-proof-exact-digest" as const,
  registryPolicyDigest: stableHash({
    scope: "release-dependency-registry-policy-v1",
    registry: REGISTRY,
    platformAbi: "node20-modules-115",
    platformLibc: "glibc-debian-bookworm",
    prohibitedProtocols: PROHIBITED,
    lifecycleScripts: "forbidden",
    projectNpmrc: "forbidden",
  }),
};

export type ReleaseDependencyStorePolicy =
  typeof RELEASE_DEPENDENCY_STORE_POLICY;
