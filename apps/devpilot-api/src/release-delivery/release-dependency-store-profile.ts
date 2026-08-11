import { stableHash } from "../release-orchestration/utils/release-hash.utils";

const REGISTRY = "https://registry.npmjs.org";
const PROHIBITED = ["file:", "git:", "git+http:", "git+https:", "http:",
  "https:", "link:", "ssh:"] as const;

export const RELEASE_DEPENDENCY_STORE_POLICY = {
  contract: "lockfile-bound-dependency-store-v1" as const,
  packageManager: "pnpm" as const,
  pnpmVersion: "8.12.0",
  platformOs: "linux" as const,
  platformArchitectures: ["amd64", "arm64"] as const,
  registry: REGISTRY,
  registryPolicy: "trusted-fetcher-application-allowlist-v1" as const,
  lifecycleScripts: "forbidden" as const,
  projectNpmrc: "forbidden" as const,
  prohibitedProtocols: PROHIBITED,
  fetchImagePolicy: "launcher-proof-exact-digest" as const,
  registryPolicyDigest: stableHash({
    scope: "release-dependency-registry-policy-v1",
    registry: REGISTRY,
    prohibitedProtocols: PROHIBITED,
    lifecycleScripts: "forbidden",
    projectNpmrc: "forbidden",
  }),
};

export type ReleaseDependencyStorePolicy =
  typeof RELEASE_DEPENDENCY_STORE_POLICY;
