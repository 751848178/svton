import assert from "node:assert/strict";
import { requireFirstEnvironmentRevision } from "./parity-environment-revision-list.mjs";

const revision = requireFirstEnvironmentRevision({
  environmentId: "env",
  revisions: [
    { id: "r2", revision: 2 },
    { id: "r1", revision: 1 },
  ],
});
assert.equal(revision.id, "r1");
for (const invalid of [
  [],
  { items: [{ id: "r1", revision: 1 }] },
  { revisions: [] },
  { revisions: [{ id: "r2", revision: 2 }] },
]) {
  assert.throws(
    () => requireFirstEnvironmentRevision(invalid),
    /PARITY_ENVIRONMENT_REVISION_LIST_INVALID/,
  );
}

console.log("parity environment revision list self-test passed");
