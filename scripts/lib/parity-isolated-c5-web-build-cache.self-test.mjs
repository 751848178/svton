#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupC5WebBuildCache,
  prepareC5WebBuildCache,
} from "./parity-isolated-c5-web-build-cache.mjs";

const workspace = mkdtempSync(join(realpathSync(tmpdir()), "c5-web-cache-"));
mkdirSync(join(workspace, "apps/devpilot-web"), { recursive: true });
const nextEnvPath = join(workspace, "apps/devpilot-web/next-env.d.ts");
const tsconfigPath = join(workspace, "apps/devpilot-web/tsconfig.json");
const originalNextEnv = '/// <reference types="next" />\n';
const originalTsconfig = `${JSON.stringify({ include: ["next-env.d.ts"] })}\n`;
writeFileSync(nextEnvPath, originalNextEnv);
writeFileSync(tsconfigPath, originalTsconfig);
const environment = {
  PARITY_RUNTIME_ID: `c5-${"a".repeat(8)}-${"b".repeat(32)}`,
  PARITY_GOAL_ID: "devpilot-v13-opencode-acceptance",
  PARITY_SOURCE_REVISION: "c".repeat(40),
  PARITY_CLEANUP_OWNER_TOKEN: "d".repeat(64),
};
const cache = prepareC5WebBuildCache(environment, workspace);
assert.equal(cache.distDir, `.next/${environment.PARITY_RUNTIME_ID}/dist`);
assert.equal(
  JSON.parse(readFileSync(join(cache.root, "owner.json"), "utf8"))
    .cleanupOwnerFingerprint.length,
  64,
);
assert.equal(cache.owner.controlFiles.length, 2);

const ownerPath = join(cache.root, "owner.json");
writeFileSync(
  ownerPath,
  `${JSON.stringify({ ...cache.owner, goalId: "wrong" })}\n`,
);
assert.throws(
  () => cleanupC5WebBuildCache(cache, environment),
  /cleanup-owner/,
);
assert.equal(existsSync(cache.root), true);
writeFileSync(ownerPath, `${JSON.stringify(cache.owner)}\n`);
writeFileSync(
  nextEnvPath,
  `/// <reference path=\"./${cache.distDir}/types/routes.d.ts\" />\n`,
);
writeFileSync(
  tsconfigPath,
  `${JSON.stringify({ include: [`${cache.distDir}/types/**/*.ts`] })}\n`,
);
cleanupC5WebBuildCache(cache, environment);
assert.equal(existsSync(cache.root), false);
assert.equal(readFileSync(nextEnvPath, "utf8"), originalNextEnv);
assert.equal(readFileSync(tsconfigPath, "utf8"), originalTsconfig);

assert.throws(
  () =>
    prepareC5WebBuildCache(
      { ...environment, PARITY_RUNTIME_ID: "invalid" },
      workspace,
    ),
  /runtime-id/,
);

process.stdout.write("isolated C5 Web build cache self-test passed\n");
