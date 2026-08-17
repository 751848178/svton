import { createHash } from "node:crypto";
import { chmod, chown, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { runExternalOciCommand as command } from "./release-build-external-oci-command";
import { assertDockerExecutable, assertLauncherLabel } from "./release-build-external-oci.policy";
import { dependencyFetcherCreateArguments, dependencyNetworkCreateArguments,
  dependencyProxyConnectArguments, dependencyProxyCreateArguments,
  type DependencyNetworkJob } from "./release-dependency-network.policy";
import type { DependencyFetchIdentity } from "./release-dependency-store-contract";
import { RELEASE_DEPENDENCY_STORE_CONTRACT } from "./release-dependency-store-contract";
import { createDependencyStoreManifest, promoteDependencyStore,
  verifyDependencyStore } from "./release-dependency-store-filesystem";
import { DEPENDENCY_FETCH_PACKAGE_DIGEST,
  DEPENDENCY_FETCH_PACKAGE_JSON } from "./release-dependency-fetch-workspace";

export async function runDependencyFetchOci(input: {
  identity: DependencyFetchIdentity; lockfile: Buffer;
  cacheRoot: string; jobRoot: string; image: string; dockerExecutable: string;
  launcherLabel: string; timeoutMs: number; signal?: AbortSignal;
}) {
  if (input.signal?.aborted || input.identity.fetchImage !== input.image ||
    input.identity.jobImage !== input.image) throw invalid();
  await mkdir(join(input.cacheRoot, ".pending"), { recursive: true, mode: 0o700 });
  const controlRoot = join(input.jobRoot, "dependency-fetch-control");
  await mkdir(controlRoot, { mode: 0o700 });
  const pendingRoot = await mkdtemp(join(input.cacheRoot, ".pending", "fetch-"));
  await chown(pendingRoot, 3_000, 3_000);
  const payload = { schemaVersion: 1, ...input.identity,
    packageManifestDigest: DEPENDENCY_FETCH_PACKAGE_DIGEST };
  await Promise.all([
    writeFile(join(controlRoot, "fetch-input.json"), JSON.stringify(payload),
      { flag: "wx", mode: 0o444 }),
    writeFile(join(controlRoot, "pnpm-lock.yaml"), input.lockfile,
      { flag: "wx", mode: 0o444 }),
    writeFile(join(controlRoot, "package.json"), DEPENDENCY_FETCH_PACKAGE_JSON,
      { flag: "wx", mode: 0o444 }),
  ]);
  await chmod(controlRoot, 0o555);
  await assertPrivatePaths(input.jobRoot, input.cacheRoot, controlRoot, pendingRoot);
  const label = assertLauncherLabel(input.launcherLabel);
  const suffix = createHash("sha256").update(
    `${label}:${input.identity.fetchRunId}`).digest("hex").slice(0, 24);
  const job: DependencyNetworkJob = { fetchName: `dp-fetch-${suffix}`,
    proxyName: `dp-proxy-${suffix}`, networkName: `dp-net-${suffix}`,
    launcherLabel: label, image: input.image, controlRoot, outputRoot: pendingRoot,
    dependencyNetworkMode: input.identity.dependencyNetworkMode };
  const executable = assertDockerExecutable(input.dockerExecutable);
  try {
    await cleanup(executable, job);
    await command(executable, dependencyNetworkCreateArguments(job), 30_000);
    await command(executable, dependencyProxyCreateArguments(job), 30_000);
    await command(executable, dependencyProxyConnectArguments(job), 30_000);
    await command(executable, ["start", job.proxyName], 15_000, input.signal);
    await command(executable, dependencyFetcherCreateArguments(job), 30_000);
    const output = await command(executable, ["start", "--attach", job.fetchName],
      input.timeoutMs, input.signal);
    const result = JSON.parse(output.stdout.toString("utf8"));
    if (result?.schemaVersion !== 1 || result.status !== "succeeded" ||
      result.combinationHash !== input.identity.combinationHash) throw invalid();
    const manifest = await createDependencyStoreManifest({
      pendingRoot, combinationHash: input.identity.combinationHash,
      lockfileDigest: input.identity.lockfileDigest,
      profileId: input.identity.profileId, profileVersion: input.identity.profileVersion,
      profileSnapshotHash: input.identity.profileSnapshotHash,
      supplyChainDigest: input.identity.supplyChainDigest,
      fetchImage: input.identity.fetchImage, jobImage: input.identity.jobImage,
      pnpmVersion: input.identity.pnpmVersion, platformOs: input.identity.platformOs,
      platformArch: input.identity.platformArch,
      platformAbi: input.identity.platformAbi, platformLibc: input.identity.platformLibc,
      registryPolicyDigest: input.identity.registryPolicyDigest,
      dependencyNetworkMode: input.identity.dependencyNetworkMode,
      engineEvidenceDigest: input.identity.engineEvidenceDigest,
    });
    const root = await promoteDependencyStore({ cacheRoot: input.cacheRoot,
      pendingRoot, manifest });
    await verifyDependencyStore(root, manifest);
    return manifest;
  } finally {
    await cleanup(executable, job);
    await rm(pendingRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function cleanup(executable: string, job: DependencyNetworkJob) {
  for (const name of [job.fetchName, job.proxyName]) {
    const ids = await selected(executable, ["ps", "--all", "--quiet",
      "--filter", `name=^/${name}$`, "--filter",
      `label=devpilot.release-build.launcher=${job.launcherLabel}`, "--filter",
      `label=devpilot.release-build.contract=${RELEASE_DEPENDENCY_STORE_CONTRACT}`]);
    for (const id of ids) {
      await command(executable, ["kill", id], 15_000).catch(() => undefined);
      await command(executable, ["rm", "--force", id], 30_000).catch(() => undefined);
    }
  }
  const networks = await selected(executable, ["network", "ls", "--quiet",
    "--filter", `name=^${job.networkName}$`, "--filter",
    `label=devpilot.release-build.launcher=${job.launcherLabel}`, "--filter",
    `label=devpilot.release-build.contract=${RELEASE_DEPENDENCY_STORE_CONTRACT}`]);
  for (const id of networks) await command(executable,
    ["network", "rm", id], 30_000).catch(() => undefined);
}

async function selected(executable: string, args: string[]) {
  const output = await command(executable, args, 15_000).catch(() => null);
  return output ? output.stdout.toString("utf8").split(/\s+/)
    .filter((id) => /^[a-f0-9]{12,64}$/.test(id)) : [];
}

async function assertPrivatePaths(jobRoot: string, cacheRoot: string,
  controlRoot: string, pendingRoot: string) {
  const [job, cache, control, pending] = await Promise.all(
    [jobRoot, cacheRoot, controlRoot, pendingRoot].map((path) => realpath(path)));
  if (![job, cache, control, pending].every(isAbsolute) ||
    !inside(job, control) || !inside(cache, pending) || control === pending)
    throw invalid();
}
function inside(root: string, target: string) {
  const path = relative(root, target);
  return path && !path.startsWith("..") && !isAbsolute(path);
}
function invalid() { return new Error("Dependency fetch OCI result is invalid"); }
