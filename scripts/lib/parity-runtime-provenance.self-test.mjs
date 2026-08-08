import assert from "node:assert/strict";
import {
  assertRuntimeImageLabels,
  expectedRuntimeImageLabels,
  RUNTIME_LABELS,
} from "./parity-runtime-provenance.mjs";

const expected = expectedRuntimeImageLabels({
  sourceRevision: "a".repeat(40),
  sourceTreeSha256: "b".repeat(64),
  runtimeId: "c5-proof",
});
const labels = {
  [RUNTIME_LABELS.revision]: expected.revision,
  [RUNTIME_LABELS.tree]: expected.tree,
  [RUNTIME_LABELS.runtime]: expected.runtime,
};
assert.equal(assertRuntimeImageLabels(labels, expected), true);
for (const label of Object.values(RUNTIME_LABELS)) {
  assert.throws(
    () =>
      assertRuntimeImageLabels({ ...labels, [label]: "substituted" }, expected),
    /mismatch/,
  );
}
assert.throws(() => assertRuntimeImageLabels([], expected), /labels-type/);

console.log("parity runtime provenance self-test passed");
