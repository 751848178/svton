import assert from "node:assert/strict";
import {
  exercisePositiveBuildGate,
  positiveBuildGateChecks,
  positiveReleaseFlowProfile,
} from "./parity-positive-build-gate.mjs";

const catalog = (confirmed = []) => ({
  checks: [{ id: "C03", evaluationId: "evaluation-c03" }],
  decisions: { build: { allowed: true, confirmedManualGateIds: confirmed } },
});
let confirmations = 0;
const basic = await exercisePositiveBuildGate({
  profile: "basic_v1",
  catalog: catalog(),
  reviewerEmail: "reviewer@example.test",
  confirm: async () => {
    confirmations += 1;
  },
  refresh: async () => catalog(["C03"]),
});
assert.equal(confirmations, 0);
assert.equal(basic.approvalCount, 0);
assert.equal(
  positiveBuildGateChecks(basic, "reviewer@example.test").every(
    (item) => item.pass,
  ),
  true,
);

const governed = await exercisePositiveBuildGate({
  profile: "governed_v1",
  catalog: catalog(),
  reviewerEmail: "reviewer@example.test",
  confirm: async () => {
    confirmations += 1;
    return { manualApprovals: [{}] };
  },
  refresh: async () => catalog(["C03"]),
});
assert.equal(confirmations, 1);
assert.equal(governed.approvalCount, 1);
assert.equal(
  positiveBuildGateChecks(governed, "reviewer@example.test").every(
    (item) => item.pass,
  ),
  true,
);
assert.equal(positiveReleaseFlowProfile({}), "basic_v1");
assert.equal(
  positiveReleaseFlowProfile({ DEVPILOT_RELEASE_FLOW_PROFILE: "governed_v1" }),
  "governed_v1",
);
assert.throws(
  () =>
    positiveReleaseFlowProfile({ DEVPILOT_RELEASE_FLOW_PROFILE: "invalid" }),
  /PARITY_RELEASE_FLOW_PROFILE_INVALID/,
);
console.log("parity positive build gate self-test passed");
