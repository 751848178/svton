import type { ReleaseGateDecision } from "./release-gate-decision.types";

export function promotionBlockedResult(decision: ReleaseGateDecision) {
  return {
    checkpoint: decision.checkpoint,
    decisionId: decision.id,
    decisionInputHash: decision.inputHash,
    manualChecks: (decision.evaluations ?? [])
      .filter((check) => decision.manualGateIds.includes(check.gateId))
      .map((check) => ({
        gateId: check.gateId,
        evaluationId: check.evaluationId,
        status: check.status,
        reasonCode: check.reasonCode,
        reason: check.reason,
        providerKey: check.providerKey,
      })),
  };
}

export function presentPromotionBlocker(
  rows: Array<{ id: string; result: unknown; errorCode: string | null; errorMessage: string | null }>,
  evaluations: Array<{ id: string; manualApprovals: Array<{ id: string }> }> = [],
) {
  if (rows.length !== 1) return null;
  const result = record(rows[0].result);
  const manualChecks = Array.isArray(result.manualChecks)
    ? result.manualChecks.filter(validManualCheck)
    : [];
  return {
    commandId: rows[0].id,
    errorCode: rows[0].errorCode,
    errorMessage: rows[0].errorMessage,
    checkpoint: typeof result.checkpoint === "string" ? result.checkpoint : null,
    decisionId: typeof result.decisionId === "string" ? result.decisionId : null,
    manualChecks: manualChecks.map((check) => ({
      ...record(check),
      confirmed: evaluations.some((evaluation) =>
        evaluation.id === record(check).evaluationId &&
        evaluation.manualApprovals.length > 0),
    })),
  };
}

function validManualCheck(value: unknown) {
  const row = record(value);
  const reason = record(row.reason);
  return typeof row.gateId === "string" &&
    typeof row.evaluationId === "string" &&
    typeof row.reasonCode === "string" &&
    typeof reason.zh === "string" && typeof reason.en === "string";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
