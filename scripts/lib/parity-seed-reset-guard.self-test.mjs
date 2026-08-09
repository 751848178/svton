#!/usr/bin/env node
import assert from "node:assert/strict";
import { downAfterVerifiedOwnership } from "./parity-seed-reset-guard.mjs";

const runtime = { runtimeId: "c5-test" };
const expectedImageIds = { api: "api", web: "web", "route-control": "route" };

let downCalls = 0;
let verified = false;
await downAfterVerifiedOwnership({
  runtime,
  expectedImageIds,
  verifyOwnership(actualRuntime, execute, actualImageIds) {
    verified = true;
    assert.equal(actualRuntime, runtime);
    assert.equal(execute, undefined);
    assert.equal(actualImageIds, expectedImageIds);
  },
  async down() {
    downCalls += 1;
  },
});
assert.equal(verified, true);
assert.equal(downCalls, 1);

await assert.rejects(
  downAfterVerifiedOwnership({
    runtime,
    expectedImageIds,
    verifyOwnership() {
      throw new Error("foreign compose resource");
    },
    async down() {
      downCalls += 1;
    },
  }),
  /foreign compose resource/,
);
assert.equal(downCalls, 1);

process.stdout.write("parity reset ownership guard self-test passed\n");
