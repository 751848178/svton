#!/usr/bin/env node
import assert from "node:assert/strict";
import { negativeStepChecks } from "./parity-negative-e2e-evidence.mjs";

const result = {
  status: 422,
  code: "RELEASE_GATE_BLOCKED",
  decisionAllowed: false,
  decisionBlockers: ["C01"],
  c01: {
    status: "blocked",
    reasonCode: "repository_verification_failed",
  },
  dbBuildRunDelta: 0,
};
assert.deepEqual(failures(result), []);

const legacy = structuredClone(result);
legacy.c01.status = "failed";
assert.deepEqual(failures(legacy), ["c01Status"]);

process.stdout.write("negative C01 blocked status self-test passed\n");

function failures(value) {
  return negativeStepChecks("ac-025-build-gate-rejected", value)
    .filter((item) => item.pass !== true)
    .map((item) => item.name);
}
