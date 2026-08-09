#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildC5WorkspaceClosures,
  C5_WORKSPACE_BUILD_SELECTORS,
} from "./parity-isolated-c5-workspace-builds.mjs";

const calls = [];
const environment = { PARITY_SOURCE_REVISION: "a".repeat(40) };
buildC5WorkspaceClosures((...args) => calls.push(args), environment);

assert.deepEqual(C5_WORKSPACE_BUILD_SELECTORS, [
  "@svton/devpilot-api...",
  "@svton/devpilot-web...",
]);
assert.deepEqual(calls, [
  [
    "corepack",
    ["pnpm", "--filter", "@svton/devpilot-api...", "build"],
    environment,
  ],
  [
    "corepack",
    ["pnpm", "--filter", "@svton/devpilot-web...", "build"],
    environment,
  ],
]);
console.log("parity isolated C5 workspace build closure self-test passed");
