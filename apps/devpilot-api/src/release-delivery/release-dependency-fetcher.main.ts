import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { runReleaseBuildArgv } from "./release-build-argv-command-runner";
import { buildSourcePolicySnapshot, sourcePolicySnapshotHash } from "./source-policy-snapshot.policy";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { createDependencyFetchWorkspace, DEPENDENCY_FETCH_PACKAGE_DIGEST,
  dependencyFetchArgv } from "./release-dependency-fetch-workspace";

type FetchInput = {
  schemaVersion: 1; combinationHash: string; lockfileDigest: string;
  profileId: string; profileVersion: number; pnpmVersion: string;
  profileSnapshotHash: string; supplyChainDigest: string;
  packageManifestDigest: string;
  platformOs: "linux"; platformArch: "amd64" | "arm64";
  platformAbi: string; platformLibc: string;
  registryPolicyDigest: string;
};

async function main() {
  const input = await readInput(process.argv[2]);
  const profile = resolveRegisteredReleaseBuildProfile(input.profileId);
  const policy = profile?.dependencyStorePolicy;
  if (!profile || profile.profileVersion !== input.profileVersion ||
    policy?.pnpmVersion !== input.pnpmVersion || policy.platformOs !== input.platformOs ||
    !policy.platformArchitectures.includes(input.platformArch) ||
    policy.platformAbi !== input.platformAbi || policy.platformLibc !== input.platformLibc ||
    sourcePolicySnapshotHash(buildSourcePolicySnapshot(profile)) !== input.profileSnapshotHash ||
    expectedReleaseBuildSupplyProof(profile).supplyChainDigest !== input.supplyChainDigest ||
    policy.registryPolicyDigest !== input.registryPolicyDigest ||
    input.packageManifestDigest !== DEPENDENCY_FETCH_PACKAGE_DIGEST) throw invalid();
  const executable = profile.packageManagers.pnpm?.executable;
  if (!executable) throw invalid();
  const workspace = await createDependencyFetchWorkspace({ controlRoot: "/job",
    temporaryRoot: "/tmp", packageDigest: input.packageManifestDigest,
    lockfileDigest: input.lockfileDigest });
  try {
    const outcome = await runReleaseBuildArgv({ executable,
      args: dependencyFetchArgv(workspace.root), cwd: workspace.root,
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/home",
        TMPDIR: "/tmp", CI: "true", npm_config_registry: policy.registry,
        HTTPS_PROXY: "http://registry-egress-proxy:3128",
        HTTP_PROXY: "http://registry-egress-proxy:3128",
        npm_config_https_proxy: "http://registry-egress-proxy:3128",
        npm_config_proxy: "http://registry-egress-proxy:3128" },
      timeoutMs: 10 * 60_000, cancelGraceMs: 5_000 });
    if (outcome.kind !== "completed" || outcome.exitCode !== 0)
      throw new Error("Dependency fetch failed");
    process.stdout.write(JSON.stringify({ schemaVersion: 1, status: "succeeded",
      combinationHash: input.combinationHash }));
  } finally { await workspace.cleanup(); }
}

async function readInput(path: string) {
  const value = JSON.parse((await readBounded(path, 64 * 1024)).toString("utf8"));
  if (value?.schemaVersion !== 1 || !hex(value.combinationHash) ||
    !hex(value.lockfileDigest) || !hex(value.registryPolicyDigest) ||
    !hex(value.profileSnapshotHash) || !hex(value.supplyChainDigest) ||
    !hex(value.packageManifestDigest) ||
    typeof value.profileId !== "string" || !Number.isInteger(value.profileVersion) ||
    typeof value.pnpmVersion !== "string" || value.platformOs !== "linux" ||
    !["amd64", "arm64"].includes(value.platformArch) ||
    typeof value.platformAbi !== "string" || typeof value.platformLibc !== "string")
    throw invalid();
  return value as FetchInput;
}
async function readBounded(path: string, limit: number) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw invalid();
    return handle.readFile();
  } finally { await handle.close(); }
}
function hex(value: unknown) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function invalid() { return new Error("Dependency fetch input is invalid"); }

void main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : "Dependency fetch failed");
  process.exitCode = 1;
});
