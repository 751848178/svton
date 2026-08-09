#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildC5WorkspaceClosures,
  C5_WORKSPACE_BUILD_SELECTORS,
  C5_WORKSPACE_BUILD_TIMEOUT_MS,
} from "./parity-isolated-c5-workspace-builds.mjs";

const calls = [];
const environment = { PARITY_SOURCE_REVISION: "a".repeat(40) };
buildC5WorkspaceClosures((...args) => calls.push(args), environment);

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
    buildEnvironment,
    { timeoutMs: C5_WORKSPACE_BUILD_TIMEOUT_MS },
  ],
]);
assert.equal(environment.CI, undefined);
assert.equal(environment.NEXT_TELEMETRY_DISABLED, undefined);
console.log("parity isolated C5 workspace build closure self-test passed");
