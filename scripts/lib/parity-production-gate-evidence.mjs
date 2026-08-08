import { check, predicate } from "./parity-e2e-evidence.mjs";

export function productionGateEvidence(gate, resultGate, expected) {
  return { gate, resultGate, expected };
}

export function selectExactProductionGate(rows, expected) {
  return rows.find((row) =>
    row.releaseOrderId === expected.releaseOrderId &&
    row.stage === "production" &&
    row.requestKey === expected.finalGateKey);
}

export function productionGateEvidenceChecks(proof = {}) {
  const gate = proof.gate || {};
  const snapshot = gate.inputSnapshot || {};
  const action = snapshot.actionInput || {};
  const resultGate = proof.resultGate || {};
  const expected = proof.expected || {};
  return [
    predicate("finalGateExists", Boolean(proof.gate), proof.gate),
    check("finalGateReleaseOrderId", gate.releaseOrderId, expected.releaseOrderId),
    check("finalGateStage", gate.stage, "production"),
    check("finalGatePhase", gate.phase, "deploy"),
    check("finalGateRequestKey", gate.requestKey, expected.finalGateKey),
    check("finalGateActionRunType", gate.actionRunType, "deployment_run"),
    check("finalGateActionRunId", gate.actionRunId, expected.deploymentRunId),
    predicate("finalGateConsumedAt", validTimestamp(gate.consumedAt), gate.consumedAt),
    check("finalGateAllowed", gate.allowed, true),
    predicate("finalGateNoBlockers", emptyArray(gate.blockerGateIds), gate.blockerGateIds),
    predicate("finalGateNoIntegrityErrors", emptyArray(gate.integrityErrors), gate.integrityErrors),
    predicate("finalGateInputHash", /^[a-f0-9]{64}$/.test(gate.inputHash || ""), gate.inputHash),
    check("finalGateSnapshotVersion", snapshot.version, 1),
    check("finalGateSnapshotStage", snapshot.stage, "production"),
    check("finalGateSnapshotPhase", snapshot.phase, "deploy"),
    check("finalGateCheckpoint", action.checkpoint, "post_execution"),
    check("finalGateDeploymentRunId", action.deploymentRunId, expected.deploymentRunId),
    check("finalGateReleaseRunId", action.releaseRunId, expected.releaseRunId),
    check("finalGateEnvironmentId", action.environmentId, expected.environmentId),
    check("finalGateManifestId", action.manifestId, expected.manifestId),
    check("finalGateBuildRunId", action.buildRunId, expected.buildRunId),
    check("finalGateConfigRevisionId", action.configRevisionId, expected.configRevisionId),
    check("deploymentReleaseRunId", expected.deploymentReleaseRunId, expected.releaseRunId),
    check("deploymentEnvironmentId", expected.deploymentEnvironmentId, expected.environmentId),
    check("deploymentManifestId", expected.deploymentManifestId, expected.manifestId),
    check("resultGateId", resultGate.id, gate.id),
    check("resultGateStage", resultGate.stage, gate.stage),
    check("resultGateInputHash", resultGate.inputHash, gate.inputHash),
  ];
}

function emptyArray(value) {
  return Array.isArray(value) && value.length === 0;
}

function validTimestamp(value) {
  return value instanceof Date
    ? Number.isFinite(value.getTime())
    : typeof value === "string" && Number.isFinite(Date.parse(value));
}
