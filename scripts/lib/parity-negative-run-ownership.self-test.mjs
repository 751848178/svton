import assert from "node:assert/strict";
import { assertNoPreexistingActiveRuns } from "./parity-negative-run-ownership.mjs";

assert.deepEqual(assertNoPreexistingActiveRuns([]), {
  canceledStaleRuns: 0,
  runningReleaseRuns: 0,
});
for (const status of ["awaiting_approval", "running"]) {
  assert.throws(
    () => assertNoPreexistingActiveRuns([{ id: `foreign-${status}`, status }]),
    new RegExp(`foreign-active-runs:foreign-${status}`),
  );
}
assert.throws(
  () => assertNoPreexistingActiveRuns([{ id: "bad", status: "succeeded" }]),
  /inventory-row/,
);

console.log("parity negative run ownership self-test passed");
