#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  captureRouteAuditBestEffort,
  cleanupFailedIsolatedAcceptance,
} from "./parity-isolated-c5-failure.mjs";

const context = { runtimeId: "c5-test" };
const audit = await captureRouteAuditBestEffort(
  async () => {
    throw new Error("route audit persistence failed");
  },
  "/repo",
  context,
);

assert.equal(audit.receipt.status, "capture_failed");
assert.equal(audit.receipt.error, "route audit persistence failed");

let cleanupCalled = false;
try {
  const originalError = new Error("history failed");
  await cleanupFailedIsolatedAcceptance({
    captureRouteAudit: async () => {
      throw new Error("route audit failed too");
    },
    cleanup: async (_context, error, capturedAudit) => {
      cleanupCalled = true;
      assert.equal(error, originalError);
      assert.equal(capturedAudit.receipt.status, "capture_failed");
    },
    root: "/repo",
    context,
    error: originalError,
  });
  throw originalError;
} catch (error) {
  assert.equal(error.message, "history failed");
}
assert.equal(cleanupCalled, true);

process.stdout.write("isolated C5 failure cleanup self-test passed\n");
