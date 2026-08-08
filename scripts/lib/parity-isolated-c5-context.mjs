import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  parityRuntimeConfig,
  requireVerifiedRuntimeIdentity,
} from "./parity-runtime-config.mjs";
import { allocateDistinctLoopbackPorts } from "./parity-runtime-port-allocation.mjs";

const PUBLIC_ENVIRONMENT_KEYS = Object.freeze([
  "PARITY_COMPOSE_PROJECT",
  "PARITY_DATABASE_NAME",
  "PARITY_WEB_PORT",
  "PARITY_API_PORT",
  "PARITY_MYSQL_PORT",
  "PARITY_REDIS_PORT",
  "PARITY_SSH_PORT",
  "PARITY_TARGET_PORT",
  "PARITY_API_IMAGE",
  "PARITY_WEB_IMAGE",
  "PARITY_SOURCE_REVISION",
  "PARITY_SOURCE_TREE_SHA256",
  "PARITY_RUNTIME_ID",
  "PARITY_REQUIRE_VERIFIED_RUNTIME",
  "PARITY_FIXTURE_GIT_ROOT",
  "NEXT_PUBLIC_API_URL",
]);

export async function createIsolatedC5Context(root, runtimeRoot, baseEnv) {
  requireCleanSource(root);
  const revision = git(root, ["rev-parse", "HEAD"]).trim();
  const trackedIndex = git(root, ["ls-files", "-s"]);
  const treeSha256 = createHash("sha256")
    .update(`${revision}\n${trackedIndex}`)
    .digest("hex");
  const nonce = randomBytes(4).toString("hex");
  const runtimeId = `c5-${revision.slice(0, 8)}-${nonce}`;
  const ports = await allocateDistinctLoopbackPorts(6);
  const runDirectory = join(runtimeRoot, runtimeId);
  const manifestPath = join(runDirectory, "runtime.json");
  await mkdir(runtimeRoot, { recursive: true, mode: 0o700 });
  const rootStats = await lstat(runtimeRoot, { bigint: true });
  if (
    !rootStats.isDirectory() ||
    rootStats.isSymbolicLink() ||
    rootStats.uid !== BigInt(process.geteuid()) ||
    (await realpath(runtimeRoot)) !== runtimeRoot
  ) {
    throw new Error("PARITY_C5_RUNTIME_ROOT_INVALID");
  }
  await mkdir(runDirectory, { recursive: false, mode: 0o700 });
  const environment = {
    ...baseEnv,
    PARITY_COMPOSE_PROJECT: `devpilot-parity-${runtimeId}`,
    PARITY_DATABASE_NAME: `devpilot_parity_${revision.slice(0, 8)}_${nonce}`,
    PARITY_WEB_PORT: String(ports[0]),
    PARITY_API_PORT: String(ports[1]),
    PARITY_MYSQL_PORT: String(ports[2]),
    PARITY_REDIS_PORT: String(ports[3]),
    PARITY_SSH_PORT: String(ports[4]),
    PARITY_TARGET_PORT: String(ports[5]),
    PARITY_API_IMAGE: `devpilot-parity-api:${revision.slice(0, 8)}-${nonce}`,
    PARITY_WEB_IMAGE: `devpilot-parity-web:${revision.slice(0, 8)}-${nonce}`,
    PARITY_SOURCE_REVISION: revision,
    PARITY_SOURCE_TREE_SHA256: treeSha256,
    PARITY_RUNTIME_ID: runtimeId,
    PARITY_REQUIRE_VERIFIED_RUNTIME: "1",
    PARITY_FIXTURE_GIT_ROOT: join(runDirectory, "fixture-repo"),
    NEXT_PUBLIC_API_URL: `http://localhost:${ports[1]}`,
  };
  requireVerifiedRuntimeIdentity(parityRuntimeConfig(environment));
  return Object.freeze({
    environment,
    manifestPath,
    revision,
    runDirectory,
    runtimeId,
    treeSha256,
  });
}

export async function writeRunningC5Manifest(context, history) {
  const manifest = {
    status: "running_verified",
    manifestVersion: 1,
    createdAt: new Date().toISOString(),
    revision: context.revision,
    treeSha256: context.treeSha256,
    runtimeId: context.runtimeId,
    runDirectory: context.runDirectory,
    history,
    environment: publicEnvironment(context.environment),
  };
  await writeFile(
    context.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600, flag: "wx" },
  );
  await chmod(context.manifestPath, 0o600);
}

export async function loadRunningC5Manifest(value, runtimeRoot, baseEnv) {
  const manifestPath = await requireManifestPath(value, runtimeRoot);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const environment = { ...baseEnv, ...manifest.environment };
  const runtime = parityRuntimeConfig(environment);
  requireVerifiedRuntimeIdentity(runtime);
  if (
    manifest.runtimeId !== runtime.runtimeId ||
    manifest.status !== "running_verified" ||
    manifest.runDirectory !== dirname(manifestPath) ||
    environment.PARITY_FIXTURE_GIT_ROOT !==
      join(manifest.runDirectory, "fixture-repo")
  ) {
    throw manifestError("identity-or-owned-paths");
  }
  return { environment, manifest, manifestPath };
}

export async function markC5ManifestDestroyed(loaded) {
  loaded.manifest.status = "destroyed";
  loaded.manifest.destroyedAt = new Date().toISOString();
  await writeFile(
    loaded.manifestPath,
    `${JSON.stringify(loaded.manifest, null, 2)}\n`,
    { mode: 0o600 },
  );
}

function publicEnvironment(environment) {
  return Object.fromEntries(
    PUBLIC_ENVIRONMENT_KEYS.map((key) => [key, environment[key]]),
  );
}

async function requireManifestPath(value, runtimeRoot) {
  const path = resolve(String(value || ""));
  if (
    dirname(dirname(path)) !== runtimeRoot ||
    path !== join(dirname(path), "runtime.json")
  ) {
    throw manifestError("path");
  }
  const stats = await lstat(path);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    (await realpath(path)) !== path
  ) {
    throw manifestError("file-policy");
  }
  return path;
}

function requireCleanSource(root) {
  if (git(root, ["status", "--porcelain"]).trim()) {
    throw new Error("PARITY_C5_SOURCE_INVALID: dirty-worktree");
  }
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "git failed");
  return result.stdout;
}

function manifestError(reason) {
  return new Error(`PARITY_C5_MANIFEST_INVALID: ${reason}`);
}
