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
  loadRunningC5Manifest,
  markC5ManifestDestroyed,
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
  PARITY_SOURCE_REVISION: `a1b2c3d4${"a".repeat(32)}`,
  PARITY_SOURCE_TREE_SHA256: "b".repeat(64),
  PARITY_RUNTIME_ID: runtimeId,
  PARITY_REQUIRE_VERIFIED_RUNTIME: "1",
  PARITY_FIXTURE_GIT_ROOT: join(runDirectory, "fixture-repo"),
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
};
await writeRunningC5Manifest(context, { status: "passed" });
const source = await readFile(manifestPath, "utf8");
assert.doesNotMatch(source, /must-not-persist|PARITY_ADMIN_PASSWORD/);
const loaded = await loadRunningC5Manifest(manifestPath, temp, {});
assert.equal(loaded.manifest.runtimeId, runtimeId);
await markC5ManifestDestroyed(loaded);
await assert.rejects(
  loadRunningC5Manifest(manifestPath, temp, {}),
  /identity-or-owned-paths/,
);

const symlinkRun = join(temp, "c5-deadbeef-deadbeef");
await mkdir(symlinkRun);
await symlink(manifestPath, join(symlinkRun, "runtime.json"));
await assert.rejects(
  loadRunningC5Manifest(join(symlinkRun, "runtime.json"), temp, {}),
  /file-policy/,
);

await rm(temp, { recursive: true });
console.log("parity isolated C5 context self-test passed");
