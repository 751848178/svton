import { createHash } from "node:crypto";
import { chmod, chown, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { runExternalOciCommand as command } from "./release-build-external-oci-command";
import { assertDockerExecutable, assertLauncherLabel,
  dependencyFetchDockerArguments } from "./release-build-external-oci.policy";
import { createDependencyStoreManifest, promoteDependencyStore,
  verifyDependencyStore } from "./release-dependency-store-filesystem";

export type DependencyFetchIdentity = {
  fetchRunId: string; combinationHash: string; lockfileDigest: string;
  profileId: string; profileVersion: number; pnpmVersion: string;
  platformOs: "linux"; platformArch: "amd64" | "arm64";
  registryPolicyDigest: string;
};

export async function runDependencyFetchOci(input: {
  identity: DependencyFetchIdentity; lockfile: Buffer;
  cacheRoot: string; jobRoot: string; image: string; dockerExecutable: string;
  launcherLabel: string; timeoutMs: number; signal?: AbortSignal;
}) {
  await mkdir(join(input.cacheRoot, ".pending"), { recursive: true, mode: 0o700 });
  const controlRoot = join(input.jobRoot, "dependency-fetch-control");
  await mkdir(controlRoot, { mode: 0o700 });
  const pendingRoot = await mkdtemp(join(input.cacheRoot, ".pending", "fetch-"));
  await chown(pendingRoot, 3_000, 3_000);
  const payload = { schemaVersion: 1, ...input.identity };
  await Promise.all([
    writeFile(join(controlRoot, "fetch-input.json"), JSON.stringify(payload),
      { flag: "wx", mode: 0o444 }),
    writeFile(join(controlRoot, "pnpm-lock.yaml"), input.lockfile,
      { flag: "wx", mode: 0o444 }),
  ]);
  await chmod(controlRoot, 0o555);
  await assertPrivatePaths(input.jobRoot, input.cacheRoot, controlRoot, pendingRoot);
  const label = assertLauncherLabel(input.launcherLabel);
  const name = `dp-fetch-${createHash("sha256").update(
    `${label}:${input.identity.fetchRunId}`).digest("hex").slice(0, 24)}`;
  const job = { name, launcherLabel: label, image: input.image,
    controlRoot, outputRoot: pendingRoot };
  const executable = assertDockerExecutable(input.dockerExecutable);
  let attempted = false;
  try {
    attempted = true;
    await command(executable, dependencyFetchDockerArguments(job), 30_000);
    const output = await command(executable, ["start", "--attach", name],
      input.timeoutMs, input.signal);
    const result = JSON.parse(output.stdout.toString("utf8"));
    if (result?.schemaVersion !== 1 || result.status !== "succeeded" ||
      result.combinationHash !== input.identity.combinationHash) throw invalid();
    const manifest = await createDependencyStoreManifest({
      pendingRoot, combinationHash: input.identity.combinationHash,
      lockfileDigest: input.identity.lockfileDigest,
      profileId: input.identity.profileId, profileVersion: input.identity.profileVersion,
      pnpmVersion: input.identity.pnpmVersion, platformOs: input.identity.platformOs,
      platformArch: input.identity.platformArch,
      registryPolicyDigest: input.identity.registryPolicyDigest,
    });
    const root = await promoteDependencyStore({ cacheRoot: input.cacheRoot,
      pendingRoot, manifest });
    await verifyDependencyStore(root, manifest);
    return manifest;
  } finally {
    if (attempted) {
      await command(executable, ["kill", name], 15_000).catch(() => undefined);
      await command(executable, ["rm", "--force", name], 30_000)
        .catch(() => undefined);
    }
    await rm(pendingRoot, { recursive: true, force: true }).catch(() => undefined);
  }
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
