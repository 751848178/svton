#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  productionGateEvidence,
  productionGateEvidenceChecks,
  selectExactProductionGate,
} from "./parity-production-gate-evidence.mjs";
import { productionRouteEvidenceChecks } from "./parity-production-route-evidence.mjs";

const expected = {
  releaseOrderId: "order-1",
  releaseRunId: "release-1",
  deploymentRunId: "deployment-1",
  environmentId: "production-1",
  manifestId: "manifest-1",
  buildRunId: "build-1",
  configRevisionId: "config-2",
  finalGateKey: "final:release-1:deployment-1",
  deploymentReleaseRunId: "release-1",
  deploymentEnvironmentId: "production-1",
  deploymentManifestId: "manifest-1",
};
const exact = gateFixture(expected);
const newer = {
  ...structuredClone(exact),
  id: "gate-newer-other-run",
  requestKey: "final:release-newer:deployment-newer",
  actionRunId: "deployment-newer",
};
const selected = selectExactProductionGate([newer, exact], expected);
assert.equal(selected?.id, exact.id);
const valid = productionGateEvidence(selected, resultGate(exact), expected);
assertChecksPass(productionGateEvidenceChecks(valid));
assertDisjointCheckNames(
  productionGateEvidenceChecks(valid),
  productionRouteEvidenceChecks(),
);
assertRejected(productionGateEvidence(
  selectExactProductionGate([newer], expected),
  resultGate(exact),
  expected,
), "missing exact gate");

for (const mutate of [
  (proof) => { proof.gate.actionRunType = "release_run"; },
  (proof) => { proof.gate.actionRunId = "deployment-other"; },
  (proof) => { proof.gate.consumedAt = null; },
  (proof) => { proof.gate.allowed = false; },
  (proof) => { proof.gate.blockerGateIds = ["D17"]; },
  (proof) => { proof.gate.integrityErrors = ["input_drift"]; },
  (proof) => { proof.gate.inputSnapshot.actionInput.releaseRunId = "release-other"; },
  (proof) => { proof.gate.inputSnapshot.actionInput.deploymentRunId = "deployment-other"; },
  (proof) => { proof.gate.inputSnapshot.actionInput.manifestId = "manifest-other"; },
  (proof) => { proof.gate.inputSnapshot.actionInput.configRevisionId = "config-other"; },
  (proof) => { proof.gate.inputSnapshot.actionInput.buildRunId = "build-other"; },
  (proof) => { proof.gate.inputSnapshot.actionInput.environmentId = "environment-other"; },
  (proof) => { proof.resultGate.id = "gate-other"; },
  (proof) => { proof.resultGate.inputHash = "b".repeat(64); },
]) {
  const drifted = structuredClone(valid);
  mutate(drifted);
  assertRejected(drifted, "gate identity drift");
}

function gateFixture(identity) {
  return {
    id: "gate-exact",
    releaseOrderId: identity.releaseOrderId,
    stage: "production",
    phase: "deploy",
    requestKey: identity.finalGateKey,
    allowed: true,
    inputHash: "a".repeat(64),
    inputSnapshot: {
      version: 1,
      stage: "production",
      phase: "deploy",
      actionInput: {
        checkpoint: "post_execution",
        deploymentRunId: identity.deploymentRunId,
        releaseRunId: identity.releaseRunId,
        environmentId: identity.environmentId,
        manifestId: identity.manifestId,
        buildRunId: identity.buildRunId,
        configRevisionId: identity.configRevisionId,
      },
    },
    blockerGateIds: [],
    integrityErrors: [],
    actionRunType: "deployment_run",
    actionRunId: identity.deploymentRunId,
    consumedAt: "2026-08-08T00:00:00.000Z",
  };
}

function resultGate(gate) {
  return { id: gate.id, stage: gate.stage, inputHash: gate.inputHash };
}

function assertChecksPass(checks) {
  assert.deepEqual(checks.filter((item) => item.pass !== true), []);
}

function assertDisjointCheckNames(left, right) {
  const leftNames = new Set(left.map((item) => item.name));
  const overlaps = right
    .map((item) => item.name)
    .filter((name) => leftNames.has(name));
  assert.deepEqual(overlaps, []);
}

function assertRejected(proof, label) {
  assert.ok(
    productionGateEvidenceChecks(proof).some((item) => item.pass !== true),
    `${label} was accepted`,
  );
}

process.stdout.write("production gate evidence self-test passed\n");
