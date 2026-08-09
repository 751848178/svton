#!/usr/bin/env node
import assert from "node:assert/strict";
import { cleanupOwnedC5Resources } from "./parity-isolated-c5-cleanup.mjs";

const calls = [];
await assert.rejects(
  cleanupOwnedC5Resources({
    async destroyBuilder() {
      calls.push("builder");
      throw new Error("builder cleanup failed");
    },
    destroyRuntime() {
      calls.push("runtime");
      throw new Error("runtime cleanup failed");
    },
    async removeFixture() {
      calls.push("fixture");
    },
    assertNoBuilder() {
      calls.push("builder-readback");
    },
    assertNoRuntimeResources() {
      calls.push("runtime-readback");
      return {};
    },
  }),
  (error) => error instanceof AggregateError && error.errors.length === 2,
);
assert.deepEqual(calls, [
  "builder",
  "runtime",
  "fixture",
  "builder-readback",
  "runtime-readback",
]);

process.stdout.write("isolated C5 aggregate cleanup self-test passed\n");
