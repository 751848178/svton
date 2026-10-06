import assert from "node:assert/strict";
import { completePositiveProductionPromotion } from "./parity-positive-production-promotion.mjs";

const calls = [];
const request = async (method, path, headers, body) => {
  calls.push({ method, path, headers, body });
  if (path.endsWith("/evidence")) return {
    productionReleaseRuns: { items: [{ id: "release-1", promotionBlocker: {
      manualChecks: [{ gateId: "P03", evaluationId: "evaluation-1", confirmed: false }],
    } }] },
  };
  if (path.includes("/evaluations/")) return { manualApprovals: [{ id: "approval-1" }] };
  return calls.filter((item) => item.path.endsWith("/production-promotion/resume")).length === 1
    ? { id: "command-1", status: "blocked", errorCode: "RELEASE_GATE_BLOCKED" }
    : { run: { id: "deployment-1", status: "completed" } };
};

const result = await completePositiveProductionPromotion({
  request, headers: { actor: "admin" }, reviewerHeaders: { actor: "reviewer" },
  projectId: "project-1", releaseOrderId: "order-1", releaseRunId: "release-1",
  environmentId: "environment-1", deploymentRunId: "deployment-1",
  idempotencyPrefix: "positive-production",
  deploymentResult: { productionCandidate: {
    deploymentRunId: "deployment-1", candidateHash: "c".repeat(64),
  } },
});

assert.deepEqual(result, {
  candidateHash: "c".repeat(64), deploymentRunId: "deployment-1",
  blockedCommandId: "command-1", blockedStatus: "blocked", gateId: "P03",
  evaluationId: "evaluation-1", approvalCount: 1,
  completedDeploymentRunId: "deployment-1", completedStatus: "completed",
});
assert.equal(calls[2].headers.actor, "reviewer");
assert.notEqual(calls[0].body.idempotencyKey, calls[3].body.idempotencyKey);
process.stdout.write("positive production promotion self-test passed\n");
