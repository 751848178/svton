import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { cleanupPreparedC5Runtime } from "./parity-isolated-c5-cleanup-runtime.mjs";
import * as c5Manifest from "./parity-isolated-c5-manifest.mjs";
import { readC5BuiltImageIds } from "./parity-isolated-c5-resource-identity.mjs";
import { cleanupReceiptFor } from "./parity-isolated-c5-receipts.mjs";
import {
  assertRuntimeImageLabels,
  expectedRuntimeImageLabels,
} from "./parity-runtime-provenance.mjs";
import { parityRuntimeConfig } from "./parity-runtime-config.mjs";

const defaults = {
  cleanupPreparedC5Runtime,
  cleanupReceiptFor,
  loadDestroyableC5Manifest: c5Manifest.loadDestroyableC5Manifest,
  markC5ManifestDestroyed: c5Manifest.markC5ManifestDestroyed,
  parityRuntimeConfig,
  readC5BuiltImageIds,
};

export function createLocalReleaseCleanup(
  root,
  runtimeRoot,
  baseEnv = process.env,
) {
  const destroy = (manifestPath) =>
    destroyLocalReleaseRuntime({
      manifestPath,
      runtimeRoot,
      baseEnv,
      destroyRuntime: (environment) => destroyParityRuntime(root, environment),
    });
  return {
    destroy,
    async destroyIfPresent(manifestPath) {
      try {
        await access(manifestPath);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
      return destroy(manifestPath);
    },
  };
}

export async function destroyLocalReleaseRuntime(
  input,
  dependencies = defaults,
) {
  const loaded = await dependencies.loadDestroyableC5Manifest(
    input.manifestPath,
    input.runtimeRoot,
    input.baseEnv,
  );
  const runtime = dependencies.parityRuntimeConfig(loaded.environment);
  const expectedImageIds = dependencies.readC5BuiltImageIds(
    loaded.manifest,
    runtime,
  );
  const failures = [];
  let cleanup;
  let localBuilder;
  let buildLauncher;
  const buildLauncherImage =
    loaded.environment.PARITY_BUILD_LAUNCHER_IMAGE ||
    `devpilot-parity-build-launcher:${runtime.runtimeId.slice(3)}`;
  await attempt(async () => {
    localBuilder = removeLocalReleaseBuilder(runtime, input.executeDocker);
  }, failures);
  await attempt(async () => {
    cleanup = await dependencies.cleanupPreparedC5Runtime({
      runtime,
      environment: loaded.environment,
      expectedImageIds,
      destroyRuntime: (environment) => input.destroyRuntime(environment),
    });
  }, failures);
  await attempt(async () => {
    buildLauncher = removeBuildLauncherImage(
      runtime,
      buildLauncherImage,
      input.executeDocker,
    );
  }, failures);
  await attempt(async () => {
    assertBuildLauncherAbsent(buildLauncherImage, input.executeDocker);
  }, failures);
  if (failures.length > 0) {
    throw new AggregateError(failures, "local release cleanup failed");
  }
  const receipt = {
    ...dependencies.cleanupReceiptFor(
      runtime,
      cleanup.residualResources,
      cleanup.builderReceipt,
    ),
    localBuilder,
    buildLauncher,
  };
  await dependencies.markC5ManifestDestroyed(loaded, receipt);
  return {
    status: "destroyed",
    manifestPath: loaded.manifestPath,
    cleanupReceipt: receipt,
  };
}

export function removeLocalReleaseBuilder(runtime, execute = runDocker) {
  const listed = execute(["buildx", "ls", "--format", "{{json .}}"]);
  requireSuccess(listed, "builder-list");
  const builder = String(listed.stdout || "")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((entry) => entry.Name === runtime.builderName);
  if (!builder) return { status: "already_absent", name: runtime.builderName };
  if (
    builder.Driver !== "docker-container" ||
    builder.Nodes?.length !== 1 ||
    builder.Nodes[0]?.Name !== `${runtime.builderName}0`
  ) {
    throw cleanupError("builder-identity");
  }
  requireSuccess(
    execute(["buildx", "rm", "--force", runtime.builderName]),
    "builder-remove",
  );
  return { status: "removed", name: runtime.builderName };
}

export function removeBuildLauncherImage(runtime, image, execute = runDocker) {
  requireBuildLauncherReference(runtime, image);
  const inspected = execute(["image", "inspect", image]);
  if (missingImage(inspected)) return { status: "already_absent", image };
  requireSuccess(inspected, "inspect");
  const record = JSON.parse(inspected.stdout)[0];
  assertRuntimeImageLabels(
    record?.Config?.Labels,
    expectedRuntimeImageLabels(runtime),
  );
  requireSuccess(execute(["image", "rm", record.Id]), "remove");
  return { status: "removed", image, imageId: record.Id };
}

export function assertBuildLauncherAbsent(image, execute = runDocker) {
  const inspected = execute(["image", "inspect", image]);
  if (!missingImage(inspected)) throw cleanupError("build-launcher-residual");
  return { status: "verified_absent", image };
}

export function destroyParityRuntime(root, environment) {
  const result = spawnSync(
    process.execPath,
    ["scripts/parity-seed.mjs", "destroy"],
    {
      cwd: root,
      env: environment,
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
    },
  );
  requireSuccess(result, "runtime-destroy");
}

async function attempt(operation, failures) {
  try {
    await operation();
  } catch (error) {
    failures.push(error);
  }
}

function requireBuildLauncherReference(runtime, image) {
  if (
    image !== `devpilot-parity-build-launcher:${runtime.runtimeId.slice(3)}`
  ) {
    throw cleanupError("build-launcher-reference");
  }
}

function runDocker(args) {
  return spawnSync("docker", args, { encoding: "utf8" });
}

function missingImage(result) {
  return result.status !== 0 && /no such image/i.test(String(result.stderr));
}

function requireSuccess(result, operation) {
  if (result.status !== 0) {
    throw cleanupError(`${operation}:${result.stderr || result.status}`);
  }
}

function cleanupError(reason) {
  return new Error(`DEVPILOT_LOCAL_RELEASE_CLEANUP_INVALID: ${reason}`);
}
