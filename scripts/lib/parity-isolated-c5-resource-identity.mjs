import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireRuntimeImageIds } from "./parity-runtime-image-identity.mjs";

export async function recordC5BuiltImageIds(manifestPath, runtime, imageIds) {
  const manifest = await loadOwnedArmedManifest(manifestPath, runtime);
  manifest.resourceIdentity = {
    ...manifest.resourceIdentity,
    builtImageIds: requireRuntimeImageIds(imageIds),
    imageIdsCapturedAt: new Date().toISOString(),
  };
  await writeManifest(manifestPath, manifest);
}

export async function recordC5BuilderLifecycle(
  manifestPath,
  runtime,
  lifecycle,
) {
  const manifest = await loadOwnedArmedManifest(manifestPath, runtime);
  if (
    lifecycle?.name !== runtime.builderName ||
    !["verified", "removed"].includes(lifecycle?.status)
  ) {
    throw resourceIdentityError("builder-lifecycle");
  }
  manifest.resourceIdentity = {
    ...manifest.resourceIdentity,
    builderLifecycle: lifecycle,
  };
  await writeManifest(manifestPath, manifest);
}

export function readC5BuiltImageIds(manifest, runtime) {
  if (!manifest.resourceIdentity?.builtImageIds) return undefined;
  requireOwnedManifest(manifest, runtime);
  return requireRuntimeImageIds(manifest.resourceIdentity.builtImageIds);
}

export async function loadC5BuiltImageIds(manifestPath, runtime) {
  if (!manifestPath) throw resourceIdentityError("missing-manifest-path");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifestPath !== join(manifest.runDirectory, "runtime.json")) {
    throw resourceIdentityError("image-identity-path");
  }
  return readC5BuiltImageIds(manifest, runtime);
}

async function loadOwnedArmedManifest(manifestPath, runtime) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifestPath !== join(manifest.runDirectory, "runtime.json") ||
    manifest.status !== "cleanup_armed"
  ) {
    throw resourceIdentityError("armed-manifest");
  }
  requireOwnedManifest(manifest, runtime);
  return manifest;
}

function requireOwnedManifest(manifest, runtime) {
  if (
    manifest.runtimeId !== runtime.runtimeId ||
    manifest.goalId !== runtime.goalId ||
    manifest.cleanupOwnerToken !== runtime.cleanupOwnerToken
  ) {
    throw resourceIdentityError("owner");
  }
}

async function writeManifest(path, manifest) {
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(path, 0o600);
}

function resourceIdentityError(reason) {
  return new Error(`PARITY_C5_RESOURCE_IDENTITY_INVALID: ${reason}`);
}
