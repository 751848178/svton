#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildC5WorkspaceClosures,
  C5_WORKSPACE_BUILD_SELECTORS,
  C5_WORKSPACE_BUILD_TIMEOUT_MS,
} from "./parity-isolated-c5-workspace-builds.mjs";

const calls = [];
const runtimeId = `c5-${"a".repeat(8)}-${"b".repeat(32)}`;
const environment = {
  PARITY_RUNTIME_ID: runtimeId,
  PARITY_SOURCE_REVISION: "a".repeat(40),
};
const cache = { root: "/owned/cache", distDir: `.next/${runtimeId}/dist` };
const cacheCalls = [];
buildC5WorkspaceClosures((...args) => calls.push(args), environment, {
  prepare: (value) => {
    cacheCalls.push(["prepare", value]);
    return cache;
  },
  materialize: (value, owner) => cacheCalls.push(["materialize", value, owner]),
  cleanup: (value, owner) => cacheCalls.push(["cleanup", value, owner]),
});

assert.deepEqual(C5_WORKSPACE_BUILD_SELECTORS, [
  "@svton/devpilot-api...",
  "@svton/devpilot-web...",
]);
assert.equal(C5_WORKSPACE_BUILD_TIMEOUT_MS, 12 * 60_000);
const buildEnvironment = {
  ...environment,
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};
assert.deepEqual(calls, [
  [
    "corepack",
    ["pnpm", "--filter", "@svton/devpilot-api...", "build"],
    buildEnvironment,
    { timeoutMs: C5_WORKSPACE_BUILD_TIMEOUT_MS },
  ],
  [
    "corepack",
    ["pnpm", "--filter", "@svton/devpilot-web...", "build"],
    { ...buildEnvironment, DEVPILOT_NEXT_DIST_DIR: cache.distDir },
    { timeoutMs: C5_WORKSPACE_BUILD_TIMEOUT_MS },
  ],
]);
assert.deepEqual(cacheCalls, [
  ["prepare", environment],
  ["materialize", cache, environment],
  ["cleanup", cache, environment],
]);
assert.equal(environment.CI, undefined);
assert.equal(environment.NEXT_TELEMETRY_DISABLED, undefined);
assert.equal(environment.DEVPILOT_NEXT_DIST_DIR, undefined);
console.log("parity isolated C5 workspace build closure self-test passed");
