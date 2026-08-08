import assert from "node:assert/strict";
import { requireEnvironmentTargets } from "./parity-environment-targets.mjs";

const valid = {
  providerKey: "local-filesystem-v1",
  currentTarget: {
    bindingId: "binding",
    providerKey: "local-filesystem-v1",
    targetRef: "filesystem-release-target",
  },
  bindings: [{ id: "binding", providerKey: "local-filesystem-v1" }],
};
assert.equal(
  requireEnvironmentTargets(valid).current.targetRef,
  "filesystem-release-target",
);
for (const mutate of [
  (value) => delete value.currentTarget,
  (value) => (value.currentTarget.targetRef = ""),
  (value) => (value.currentTarget.providerKey = "other"),
  (value) => (value.bindings[0].id = "other"),
]) {
  const changed = structuredClone(valid);
  mutate(changed);
  assert.throws(
    () => requireEnvironmentTargets(changed),
    /PARITY_ENVIRONMENT_TARGETS_INVALID/,
  );
}

console.log("parity environment targets self-test passed");
