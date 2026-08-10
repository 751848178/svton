import { predicate } from "./parity-e2e-evidence.mjs";
import {
  approvalCase,
  eq,
  present,
  rejected,
  yes,
  zero,
} from "./parity-negative-e2e-check-utils.mjs";

export const NEGATIVE_CHECKS_B = {
  "ac-029-setup": (r) => [
    present("baseRevisionId", r.baseRevisionId),
    predicate(
      "baseRevisionNumber",
      Number.isInteger(r.baseRevisionNumber),
      r.baseRevisionNumber,
    ),
  ],
  "ac-029-confirm-at-r2": (r) => [
    present("releaseRunId", r.releaseRunId),
    present("approvalId", r.approvalId),
    yes("frozenAtBase", r.frozenAtBase),
  ],
  "ac-029-create-r3-drift": (r) => [
    present("r3RevisionId", r.r3RevisionId),
    yes("nowCurrent", r.nowCurrent),
  ],
  "ac-029-old-confirm-execute-rejected": (r) => [
    ...rejected(r, 422, /漂移|未批准/),
    zero("dbDeploymentRunWithRun", r.dbDeploymentRunWithRun),
    yes("currentPointerUnchanged", r.currentPointerUnchanged),
  ],
  "ac-029-cleanup": (r) => [yes("driftedRunCanceled", r.driftedRunCanceled)],
  "ac-030-rejected-approval": (r) => approvalCase(r, "rejected"),
  "ac-030-expired-approval": (r) => [
    ...approvalCase(r, "approved"),
    yes("approvalExpired", r.approvalExpired),
  ],
  "ac-030-consumed-approval": (r) => [
    ...approvalCase(r, "approved"),
    yes("approvalConsumedAtSet", r.approvalConsumedAtSet),
  ],
  "ac-031-same-idempotency-key": (r) => [
    eq("firstStatus", r.firstStatus, 201),
    eq("secondStatus", r.secondStatus, 201),
    eq("releaseRunCount", r.releaseRunCount, 1),
    yes("sameRequestConverged", r.ok),
  ],
  "ac-031-different-idempotency-keys": (r) => [
    predicate(
      "one201One409",
      [r.firstStatus, r.secondStatus].sort().join(",") === "201,409",
      [r.firstStatus, r.secondStatus],
    ),
    eq("effectiveReleaseRunCount", r.effectiveReleaseRunCount, 1),
    yes("environmentMaxOneRunEnforced", r.environmentMaxOneRunEnforced),
    present("winnerRunId", r.winnerRunId),
    present("winnerApprovalId", r.winnerApprovalId),
    yes("differentRequestConverged", r.ok),
  ],
  "ac-031-approve-winner": (r) => [
    present("approvalId", r.approvalId),
    eq("decision", r.decision, "approved"),
    eq("status", r.status, "approved"),
  ],
  "ac-031-refresh-gate-evidence": (r) => [
    predicate(
      "refreshedAt",
      Number.isFinite(Date.parse(r.refreshedAt ?? "")),
      r.refreshedAt,
    ),
  ],
  "ac-031-concurrent-execute": (r) => [
    predicate(
      "oneSuccessOneReject",
      [r.firstStatus, r.secondStatus].filter((x) => x < 300).length === 1 &&
        [r.firstStatus, r.secondStatus].some((x) => x === 409 || x === 422),
      [r.firstStatus, r.secondStatus],
    ),
    eq("deploymentRunCount", r.deploymentRunCount, 1),
    eq("deploymentRunStatus", r.deploymentRunStatus, "completed"),
    eq("releaseRunStatus", r.releaseRunStatus, "succeeded"),
    yes("approvalConsumed", r.approvalConsumed),
    present("deploymentRunId", r.deploymentRunId),
  ],
  "ac-031-capture-pointer": (r) => [
    present("pointerAfterConcurrentExecute", r.pointerAfterConcurrentExecute),
  ],
  "ac-032-setup-broken-health": (r) => [
    present("serviceId", r.serviceId),
    yes("persistedBrokenHealth", r.persistedBrokenHealth),
  ],
  "ac-032-refresh-gate-evidence": (r) => [
    predicate(
      "refreshedAt",
      Number.isFinite(Date.parse(r.refreshedAt ?? "")),
      r.refreshedAt,
    ),
  ],
  "ac-032-execute-health-fail": (r) => [
    eq("deploymentRunStatus", r.deploymentRunStatus, "failed"),
    predicate(
      "workloadHealthFailed",
      /WORKLOAD_HEALTH_FAILED/.test(r.deploymentRunError ?? ""),
      r.deploymentRunError,
    ),
    eq("releaseRunStatus", r.releaseRunStatus, "failed"),
    yes("currentPointerUnchanged", r.currentPointerUnchanged),
  ],
  "ac-032-db-state": (r) => [
    eq("deploymentRunStatus", r.deploymentRunStatus, "failed"),
    predicate(
      "workloadHealthFailed",
      /WORKLOAD_HEALTH_FAILED/.test(r.error ?? ""),
      r.error,
    ),
    eq("gateStage", r.gateDecision?.stage, "production"),
    present("gateConsumedAt", r.gateDecision?.consumedAt),
    yes("pointerUnchangedVs031Baseline", r.pointerUnchangedVs031Baseline),
    eq("releaseRunStatus", r.releaseRunStatus, "failed"),
  ],
  "ac-032-restore-service": (r) => [yes("restored", r.restored)],
};
