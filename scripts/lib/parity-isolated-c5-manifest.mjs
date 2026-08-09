import { chmod, lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  parityRuntimeConfig,
  requireVerifiedRuntimeIdentity,
} from "./parity-runtime-config.mjs";

const PUBLIC_ENVIRONMENT_KEYS = Object.freeze([
  "PARITY_COMPOSE_PROJECT",
  "PARITY_DATABASE_NAME",
  "PARITY_WEB_PORT",
  "PARITY_API_PORT",
  "PARITY_MYSQL_PORT",
  "PARITY_REDIS_PORT",
  "PARITY_SSH_PORT",
  "PARITY_TARGET_PORT",
  "PARITY_ROUTE_CONTROL_PORT",
  "PARITY_API_IMAGE",
  "PARITY_WEB_IMAGE",
  "PARITY_ROUTE_CONTROL_IMAGE",
  "PARITY_DEPLOY_TARGET_IMAGE",
  "PARITY_TARGET_WORKLOAD_IMAGE",
  "PARITY_SOURCE_REVISION",
  "PARITY_SOURCE_TREE_SHA256",
  "PARITY_RUNTIME_ID",
  "PARITY_GOAL_ID",
  "PARITY_CLEANUP_OWNER_TOKEN",
  "PARITY_BUILDX_BUILDER",
  "PARITY_REQUIRE_VERIFIED_RUNTIME",
  "PARITY_LOCAL_ACCEPTANCE_PROFILE",
  "PARITY_LOCAL_ACCEPTANCE_HOSTNAME",
  "DEVPILOT_PARITY_ROUTE_PROVIDER_KEY",
  "PARITY_FIXTURE_GIT_ROOT",
  "PARITY_C5_MANIFEST_PATH",
  "NEXT_PUBLIC_API_URL",
]);

export async function writePreparedC5Manifest(context) {
  const manifest = {
    status: "cleanup_armed",
    manifestVersion: 2,
    createdAt: new Date().toISOString(),
    revision: context.revision,
    treeSha256: context.treeSha256,
    runtimeId: context.runtimeId,
    goalId: context.environment.PARITY_GOAL_ID,
    cleanupOwnerToken: context.cleanupOwnerToken,
    runDirectory: context.runDirectory,
    history: null,
    resourceIdentity: {
      builtImageIds: null,
      builderLifecycle: {
        status: "planned",
        name: context.environment.PARITY_BUILDX_BUILDER,
      },
    },
    environment: publicEnvironment(context.environment),
  };
  await writeManifest(context.manifestPath, manifest, "wx");
}

export async function writeRunningC5Manifest(context, history, routeAudit) {
  const loaded = await loadManifest(
    context.manifestPath,
    dirname(context.runDirectory),
    {},
    ["cleanup_armed"],
  );
  loaded.manifest.status = "running_verified";
  loaded.manifest.startedAt = new Date().toISOString();
  loaded.manifest.history = history;
  loaded.manifest.routeAudit = routeAudit;
  await writeManifest(loaded.manifestPath, loaded.manifest);
}

export function loadDestroyableC5Manifest(value, runtimeRoot, baseEnv) {
  return loadManifest(value, runtimeRoot, baseEnv, [
    "cleanup_armed",
    "running_verified",
    "cleanup_failed",
  ]);
}

export async function markC5ManifestFailed(
  context,
  error,
  cleanupReceipt,
  routeAudit,
) {
  const manifest = JSON.parse(await readFile(context.manifestPath, "utf8"));
  manifest.status =
    cleanupReceipt.status === "verified_zero_residuals"
      ? "failed_cleaned"
      : "cleanup_failed";
  manifest.failedAt = new Date().toISOString();
  manifest.failure = error instanceof Error ? error.message : String(error);
  manifest.cleanupReceipt = cleanupReceipt;
  manifest.routeAudit = routeAudit ?? null;
  await writeManifest(context.manifestPath, manifest);
}

export async function markC5ManifestDestroyed(loaded, cleanupReceipt) {
  loaded.manifest.status = "destroyed";
  loaded.manifest.destroyedAt = new Date().toISOString();
  loaded.manifest.cleanupReceipt = cleanupReceipt;
  await writeManifest(loaded.manifestPath, loaded.manifest);
}

async function loadManifest(value, runtimeRoot, baseEnv, statuses) {
  const manifestPath = await requireManifestPath(value, runtimeRoot);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const environment = { ...baseEnv, ...manifest.environment };
  const runtime = parityRuntimeConfig(environment);
  requireVerifiedRuntimeIdentity(runtime);
  if (
    manifest.runtimeId !== runtime.runtimeId ||
    manifest.goalId !== runtime.goalId ||
    manifest.cleanupOwnerToken !== runtime.cleanupOwnerToken ||
    !statuses.includes(manifest.status) ||
    manifest.runDirectory !== dirname(manifestPath) ||
    environment.PARITY_FIXTURE_GIT_ROOT !==
      join(manifest.runDirectory, "fixture-repo")
  ) {
    throw manifestError("identity-or-owned-paths");
  }
  return { environment, manifest, manifestPath };
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

async function writeManifest(path, manifest, flag) {
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
    ...(flag ? { flag } : {}),
  });
  await chmod(path, 0o600);
}

function manifestError(reason) {
  return new Error(`PARITY_C5_MANIFEST_INVALID: ${reason}`);
}
