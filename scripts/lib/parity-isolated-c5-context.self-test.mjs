import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadDestroyableC5Manifest,
  markC5ManifestDestroyed,
  readC5BuiltImageIds,
  recordC5BuilderLifecycle,
  recordC5BuiltImageIds,
  writePreparedC5Manifest,
  writeRunningC5Manifest,
} from "./parity-isolated-c5-context.mjs";

const temp = await realpath(
  await mkdtemp(join(tmpdir(), "parity-c5-context-")),
);
const runtimeId = "c5-a1b2c3d4-1234abcd";
const runDirectory = join(temp, runtimeId);
const manifestPath = join(runDirectory, "runtime.json");
await mkdir(runDirectory, { mode: 0o700 });
const environment = {
  PARITY_COMPOSE_PROJECT: `devpilot-parity-${runtimeId}`,
  PARITY_DATABASE_NAME: "devpilot_parity_a1b2c3d4_1234abcd",
  PARITY_WEB_PORT: "45131",
  PARITY_API_PORT: "45132",
  PARITY_MYSQL_PORT: "45334",
  PARITY_REDIS_PORT: "45384",
  PARITY_SSH_PORT: "45222",
  PARITY_TARGET_PORT: "45992",
  PARITY_API_IMAGE: "devpilot-parity-api:a1b2c3d4-1234abcd",
  PARITY_WEB_IMAGE: "devpilot-parity-web:a1b2c3d4-1234abcd",
  PARITY_ROUTE_CONTROL_IMAGE: "devpilot-parity-route-control:a1b2c3d4-1234abcd",
  PARITY_DEPLOY_TARGET_IMAGE: "devpilot-parity-deploy-target:a1b2c3d4-1234abcd",
  PARITY_TARGET_WORKLOAD_IMAGE:
    "devpilot-parity-target-workload:a1b2c3d4-1234abcd",
  PARITY_SOURCE_REVISION: `a1b2c3d4${"a".repeat(32)}`,
  PARITY_SOURCE_TREE_SHA256: "b".repeat(64),
  PARITY_RUNTIME_ID: runtimeId,
  PARITY_GOAL_ID: "devpilot-v13-opencode-acceptance",
  PARITY_CLEANUP_OWNER_TOKEN: "c".repeat(64),
  PARITY_BUILDX_BUILDER: `devpilot-builder-${runtimeId}`,
  PARITY_ROUTE_CONTROL_PORT: "45993",
  PARITY_REQUIRE_VERIFIED_RUNTIME: "1",
  PARITY_LOCAL_ACCEPTANCE_PROFILE: "parity-hosts-v1",
  PARITY_LOCAL_ACCEPTANCE_HOSTNAME: "parity.example.test",
  DEVPILOT_PARITY_ROUTE_PROVIDER_KEY: "http-route-control-v1",
  PARITY_FIXTURE_GIT_ROOT: join(runDirectory, "fixture-repo"),
  PARITY_C5_MANIFEST_PATH: manifestPath,
  NEXT_PUBLIC_API_URL: "http://localhost:45132",
  PARITY_ADMIN_PASSWORD: "must-not-persist",
};
const context = {
  environment,
  manifestPath,
  revision: environment.PARITY_SOURCE_REVISION,
  runDirectory,
  runtimeId,
  treeSha256: environment.PARITY_SOURCE_TREE_SHA256,
  cleanupOwnerToken: environment.PARITY_CLEANUP_OWNER_TOKEN,
};
await writePreparedC5Manifest(context);
assert.equal(
  (await loadDestroyableC5Manifest(manifestPath, temp, {})).manifest.status,
  "cleanup_armed",
);
const builtImageIds = {
  api: `sha256:${"1".repeat(64)}`,
  web: `sha256:${"2".repeat(64)}`,
  "route-control": `sha256:${"3".repeat(64)}`,
  "deploy-target": `sha256:${"4".repeat(64)}`,
  "target-workload": `sha256:${"5".repeat(64)}`,
};
await recordC5BuiltImageIds(
  manifestPath,
  {
    runtimeId,
    goalId: environment.PARITY_GOAL_ID,
    cleanupOwnerToken: environment.PARITY_CLEANUP_OWNER_TOKEN,
  },
  builtImageIds,
);
await recordC5BuilderLifecycle(
  manifestPath,
  {
    runtimeId,
    goalId: environment.PARITY_GOAL_ID,
    cleanupOwnerToken: environment.PARITY_CLEANUP_OWNER_TOKEN,
    builderName: environment.PARITY_BUILDX_BUILDER,
  },
  {
    status: "removed",
    name: environment.PARITY_BUILDX_BUILDER,
    verifiedAt: new Date().toISOString(),
  },
);
await writeRunningC5Manifest(context, { status: "passed" });
const source = await readFile(manifestPath, "utf8");
assert.doesNotMatch(source, /must-not-persist|PARITY_ADMIN_PASSWORD/);
assert.match(source, /parity-hosts-v1/);
assert.match(source, /http-route-control-v1/);
const loaded = await loadDestroyableC5Manifest(manifestPath, temp, {});
assert.equal(loaded.manifest.runtimeId, runtimeId);
assert.deepEqual(
  readC5BuiltImageIds(loaded.manifest, {
    runtimeId,
    goalId: environment.PARITY_GOAL_ID,
    cleanupOwnerToken: environment.PARITY_CLEANUP_OWNER_TOKEN,
  }),
  builtImageIds,
);
assert.equal(
  loaded.manifest.resourceIdentity.builderLifecycle.status,
  "removed",
);
await markC5ManifestDestroyed(loaded, { status: "verified_zero_residuals" });
await assert.rejects(
  loadDestroyableC5Manifest(manifestPath, temp, {}),
  /identity-or-owned-paths/,
);

const symlinkRun = join(temp, "c5-deadbeef-deadbeef");
await mkdir(symlinkRun);
await symlink(manifestPath, join(symlinkRun, "runtime.json"));
await assert.rejects(
  loadDestroyableC5Manifest(join(symlinkRun, "runtime.json"), temp, {}),
  /file-policy/,
);

await rm(temp, { recursive: true });
console.log("parity isolated C5 context self-test passed");
