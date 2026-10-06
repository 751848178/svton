import assert from "node:assert/strict";
import { destroyLocalReleaseRuntime } from "./devpilot-local-release-cleanup.mjs";

const runtime = {
  runtimeId: "c5-12345678-abcdef12",
  goalId: "devpilot-local-release-rehearsal",
  cleanupOwnerToken: "a".repeat(64),
  sourceRevision: "1".repeat(40),
  sourceTreeSha256: "2".repeat(64),
};
const image = "devpilot-parity-build-launcher:12345678-abcdef12";
const labels = {
  "org.opencontainers.image.revision": runtime.sourceRevision,
  "io.svton.devpilot.source-tree-sha256": runtime.sourceTreeSha256,
  "io.svton.devpilot.runtime-id": runtime.runtimeId,
  "io.svton.devpilot.goal-id": runtime.goalId,
  "io.svton.devpilot.cleanup-owner-token": runtime.cleanupOwnerToken,
};
let imagePresent = true;
let destroyedRuntime = false;
let persistedReceipt;
const executeDocker = (args) => {
  if (args[0] === "buildx" && args[1] === "ls") {
    return { status: 0, stdout: "", stderr: "" };
  }
  if (args[0] === "image" && args[1] === "inspect") {
    return imagePresent
      ? {
          status: 0,
          stdout: JSON.stringify([
            { Id: `sha256:${"b".repeat(64)}`, Config: { Labels: labels } },
          ]),
          stderr: "",
        }
      : { status: 1, stdout: "", stderr: "No such image" };
  }
  if (args[0] === "image" && args[1] === "rm") {
    imagePresent = false;
    return { status: 0, stdout: "removed", stderr: "" };
  }
  throw new Error(`unexpected docker call: ${args.join(" ")}`);
};
const loaded = {
  manifestPath: "/runtime/c5-12345678-abcdef12/runtime.json",
  manifest: { resourceIdentity: { builtImageIds: {} } },
  environment: { PARITY_BUILD_LAUNCHER_IMAGE: image },
};
const dependencies = {
  loadDestroyableC5Manifest: async () => loaded,
  parityRuntimeConfig: () => runtime,
  readC5BuiltImageIds: () => ({ api: "image-id" }),
  cleanupPreparedC5Runtime: async (input) => {
    input.destroyRuntime(input.environment);
    return {
      residualResources: {
        containers: [],
        networks: [],
        volumes: [],
        images: [],
      },
      builderReceipt: { status: "removed", name: "builder" },
    };
  },
  cleanupReceiptFor: (_runtime, residualResources, builderReceipt) => ({
    status: "verified_zero_residuals",
    residualResources,
    builderReceipt,
  }),
  markC5ManifestDestroyed: async (_loaded, receipt) => {
    persistedReceipt = receipt;
  },
};

const result = await destroyLocalReleaseRuntime(
  {
    manifestPath: loaded.manifestPath,
    runtimeRoot: "/runtime",
    baseEnv: {},
    executeDocker,
    destroyRuntime: () => {
      destroyedRuntime = true;
    },
  },
  dependencies,
);

assert.equal(result.status, "destroyed");
assert.equal(destroyedRuntime, true);
assert.equal(result.cleanupReceipt.status, "verified_zero_residuals");
assert.equal(result.cleanupReceipt.localBuilder.status, "already_absent");
assert.equal(result.cleanupReceipt.buildLauncher.status, "removed");
assert.deepEqual(persistedReceipt, result.cleanupReceipt);
assert.equal(imagePresent, false);
console.log("devpilot-local-release-cleanup self-test passed");
