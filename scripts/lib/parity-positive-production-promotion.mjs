export async function completePositiveProductionPromotion(input) {
  const candidate = productionCandidate(
    input.deploymentResult,
    input.deploymentRunId,
  );
  const resumePath = `/projects/${input.projectId}/delivery/environment-versions/${input.environmentId}/production-promotion/resume`;
  const resumeBody = (suffix) => ({
    idempotencyKey: `${input.idempotencyPrefix}-${suffix}`,
    releaseRunId: input.releaseRunId,
    deploymentRunId: candidate.deploymentRunId,
    candidateHash: candidate.candidateHash,
  });
  const blocked = await input.request(
    "POST", resumePath, input.headers, resumeBody("before-review"),
  );
  if (blocked.status !== "blocked" || blocked.errorCode !== "RELEASE_GATE_BLOCKED") {
    throw new Error(`production promotion did not stop at manual gate: ${blocked.status}`);
  }
  const evidencePath =
    `/projects/${input.projectId}/delivery/releases/${input.releaseOrderId}/evidence`;
  const evidence = await input.request("GET", evidencePath, input.headers);
  const release = evidence.productionReleaseRuns?.items?.find(
    (item) => item.id === input.releaseRunId,
  );
  const blocker = release?.promotionBlocker;
  const gate = blocker?.manualChecks?.find(
    (item) => item.gateId === "P03" && item.confirmed !== true,
  );
  if (!gate?.evaluationId) {
    throw new Error("P03 production promotion evaluation is unavailable");
  }
  const confirmation = await input.request(
    "POST",
    `/projects/${input.projectId}/delivery/releases/${input.releaseOrderId}/gates/P03/evaluations/${gate.evaluationId}/confirm`,
    input.reviewerHeaders,
    { reason: "Independent review of the exact production promotion candidate" },
  );
  const completed = await input.request(
    "POST", resumePath, input.headers, resumeBody("after-review"),
  );
  const completedStatus = completed.run?.status ?? completed.status;
  if (completedStatus !== "completed") {
    throw new Error(`production promotion did not complete: ${completedStatus}`);
  }
  return {
    candidateHash: candidate.candidateHash,
    deploymentRunId: candidate.deploymentRunId,
    blockedCommandId: blocked.id,
    blockedStatus: blocked.status,
    gateId: gate.gateId,
    evaluationId: gate.evaluationId,
    approvalCount: confirmation.manualApprovals?.length ?? 0,
    completedDeploymentRunId: completed.run?.id ?? null,
    completedStatus,
  };
}

function productionCandidate(value, expectedDeploymentRunId) {
  const result = record(value);
  const candidate = record(result.productionCandidate);
  if (
    candidate.deploymentRunId !== expectedDeploymentRunId ||
    typeof candidate.deploymentRunId !== "string" ||
    typeof candidate.candidateHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(candidate.candidateHash)
  ) {
    throw new Error("production candidate evidence is invalid");
  }
  return candidate;
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
