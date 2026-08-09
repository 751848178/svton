#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupC5WebBuildOutput,
  materializeC5WebBuildOutput,
} from "./parity-isolated-c5-web-build-output.mjs";

const runDirectory = await realpath(
  await mkdtemp(join(tmpdir(), "f643-web-output-")),
);
const cacheRoot = join(runDirectory, "cache");
const dist = join(cacheRoot, "dist");
await mkdir(join(dist, "server"), { recursive: true });
await mkdir(join(dist, "static"));
await writeFile(join(dist, "BUILD_ID"), "current-head-build");
await writeFile(join(dist, "server", "page.js"), "server-output");
await writeFile(join(dist, "static", "asset.js"), "static-output");
const environment = {
  PARITY_RUNTIME_ID: `c5-${"a".repeat(8)}-${"b".repeat(32)}`,
  PARITY_GOAL_ID: "devpilot-v13-opencode-acceptance",
  PARITY_SOURCE_REVISION: "c".repeat(40),
  PARITY_SOURCE_TREE_SHA256: "d".repeat(64),
  PARITY_CLEANUP_OWNER_TOKEN: "e".repeat(64),
  PARITY_C5_MANIFEST_PATH: join(runDirectory, "runtime.json"),
  PARITY_WEB_DIST_ROOT: join(runDirectory, "web-image-dist"),
  NEXT_PUBLIC_API_URL: "http://localhost:45132",
};

try {
  const created = materializeC5WebBuildOutput({ root: cacheRoot }, environment);
  assert.equal(created.status, "materialized");
  assert.equal(
    await readFile(join(created.path, "BUILD_ID"), "utf8"),
    "current-head-build",
  );
  assert.ok(created.tree.files >= 3);
  assert.equal(cleanupC5WebBuildOutput(environment).status, "removed");
  assert.equal(cleanupC5WebBuildOutput(environment).status, "already_absent");
  assert.equal(cleanupC5WebBuildOutput({}).status, "not_requested");

  materializeC5WebBuildOutput({ root: cacheRoot }, environment);
  await writeFile(
    join(environment.PARITY_WEB_DIST_ROOT, "BUILD_ID"),
    "tampered",
  );
  assert.throws(() => cleanupC5WebBuildOutput(environment), /owner-or-tree/);
} finally {
  await rm(runDirectory, { recursive: true, force: true });
}
process.stdout.write("isolated C5 Web build output self-test passed\n");
