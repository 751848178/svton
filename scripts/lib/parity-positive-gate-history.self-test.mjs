import assert from "node:assert/strict";
import { summarizePositiveGateHistory } from "./parity-positive-gate-history.mjs";

const summary = summarizePositiveGateHistory([
  decision(false, ["P03"], []),
  decision(true, [], ["P03"]),
  { ...decision(false, ["C03"], []), stage: "build", phase: "commit" },
  { ...decision(true, [], ["C03"]), stage: "build", phase: "commit" },
  { ...decision(false, [], []), stage: "staging", phase: "build",
    blockerGateIds: ["B01", "B02"] },
  { ...decision(true, [], []), stage: "staging", phase: "build" },
  { ...decision(true, [], []), inputSnapshot: { checkpoint: "production_post_route" } },
]);
assert.equal(summary.decisionCount, 7);
assert.equal(summary.expectedP03BlockedCount, 1);
assert.equal(summary.expectedC03BlockedCount, 1);
assert.equal(summary.expectedStagingBlockedCount, 1);
assert.equal(summary.unexpectedBlockedCount, 0);
assert.equal(summary.confirmedP03DecisionCount, 1);
assert.equal(summary.confirmedC03DecisionCount, 1);
assert.equal(summary.recoveredStagingDecisionCount, 1);
assert.equal(summary.allowedDecisionsHaveNoBlockers, true);

const unexpected = summarizePositiveGateHistory([
  decision(false, [], []),
]);
assert.equal(unexpected.unexpectedBlockedCount, 1);
process.stdout.write("positive gate history self-test passed\n");

function decision(allowed, manualGateIds, confirmedManualGateIds) {
  return {
    id: `decision-${allowed}-${confirmedManualGateIds.length}`,
    stage: "production",
    phase: "promote",
    allowed,
    blockerGateIds: [],
    manualGateIds,
    confirmedManualGateIds,
    inputSnapshot: { checkpoint: "production_promote_pre_route" },
    createdAt: "2026-08-30T00:00:00.000Z",
  };
}
