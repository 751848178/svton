import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import {
  parityRuntimeConfig,
  requireVerifiedRuntimeIdentity,
} from "./parity-runtime-config.mjs";
import { allocateDistinctLoopbackPorts } from "./parity-runtime-port-allocation.mjs";

export {
  loadDestroyableC5Manifest,
  markC5ManifestDestroyed,
  markC5ManifestFailed,
  writePreparedC5Manifest,
  writeRunningC5Manifest,
} from "./parity-isolated-c5-manifest.mjs";
export {
  loadC5BuiltImageIds,
  readC5BuiltImageIds,
  recordC5BuilderLifecycle,
  recordC5BuiltImageIds,
} from "./parity-isolated-c5-resource-identity.mjs";

export async function createIsolatedC5Context(root, runtimeRoot, baseEnv) {
  requireCleanSource(root);
  const revision = git(root, ["rev-parse", "HEAD"]).trim();
  const trackedIndex = git(root, ["ls-files", "-s"]);
  const treeSha256 = createHash("sha256")
    .update(`${revision}\n${trackedIndex}`)
    .digest("hex");
  const nonce = randomBytes(16).toString("hex");
  const runtimeId = `c5-${revision.slice(0, 8)}-${nonce}`;
  const cleanupOwnerToken = randomBytes(32).toString("hex");
  const ports = await allocateDistinctLoopbackPorts(7);
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
    PARITY_ROUTE_CONTROL_IMAGE: `devpilot-parity-route-control:${revision.slice(0, 8)}-${nonce}`,
    PARITY_DEPLOY_TARGET_IMAGE: `devpilot-parity-deploy-target:${revision.slice(0, 8)}-${nonce}`,
    PARITY_TARGET_WORKLOAD_IMAGE: `devpilot-parity-target-workload:${revision.slice(0, 8)}-${nonce}`,
    PARITY_SOURCE_REVISION: revision,
    PARITY_SOURCE_TREE_SHA256: treeSha256,
    PARITY_RUNTIME_ID: runtimeId,
    PARITY_GOAL_ID: "devpilot-v13-opencode-acceptance",
    PARITY_CLEANUP_OWNER_TOKEN: cleanupOwnerToken,
    PARITY_BUILDX_BUILDER: `devpilot-builder-${runtimeId}`,
    PARITY_ROUTE_CONTROL_PORT: String(ports[6]),
    PARITY_ROUTE_CONTROL_TOKEN: randomBytes(32).toString("hex"),
    PARITY_REQUIRE_VERIFIED_RUNTIME: "1",
    PARITY_FIXTURE_GIT_ROOT: join(runDirectory, "fixture-repo"),
    PARITY_C5_MANIFEST_PATH: manifestPath,
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
    cleanupOwnerToken,
  });
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
