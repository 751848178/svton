import { predicate } from "./parity-e2e-evidence.mjs";
import { eq, present, yes, zero } from "./parity-negative-e2e-check-utils.mjs";

export const NEGATIVE_CHECKS_C = {
  "ac-033-create-r4-probe-404": (r) => [
    present("r4RevisionId", r.r4RevisionId),
    yes("nowCurrent", r.nowCurrent),
  ],
  "ac-033-refresh-gate-evidence": (r) => [
    predicate(
      "refreshedAt",
      Number.isFinite(Date.parse(r.refreshedAt ?? "")),
      r.refreshedAt,
    ),
  ],
  "ac-033-execute-probe-fail": (r) => [
    eq("deploymentRunStatus", r.deploymentRunStatus, "failed"),
    eq("releaseRunStatus", r.releaseRunStatus, "failed"),
  ],
  "ac-033-db-state": (r) => [
    eq("deploymentRunStatus", r.deploymentRunStatus, "failed"),
    eq("httpProbeStatus", r.httpProbe?.status, "failed"),
    eq("httpStatusCode", r.httpProbe?.statusCode, 404),
    zero("routeSwitchRuns", r.routeSwitchRunsForFailedDeploy),
    eq("routeActuallySwitched", r.routeActuallySwitched, false),
    yes("pointerUnchanged", r.pointerUnchangedVs031Baseline),
    yes("notFinalSuccess", r.notMarkedFinalSuccess),
    eq("releaseRunStatus", r.releaseRunStatus, "failed"),
  ],
  "ac-033-restore-config": (r) => [
    yes("restoredToR3", r.restoredToR3),
    yes("r4KeptInHistory", r.r4KeptInHistory),
    yes("casAppendOnlyPreserved", r.casAppendOnlyPreserved),
  ],
  "ac-034-member-read-allowed": (r) => [
    eq("status", r.status, 200),
    yes("bodyPresent", r.bodyPresent),
  ],
  "ac-034-member-execute-rejected": (r) => [
    eq("attemptCount", r.calls?.length, 5),
    predicate(
      "all403",
      r.calls?.every((x) => x.status === 403),
      r.calls,
    ),
    yes("dbBuildRunUnchanged", r.dbBuildRunUnchanged),
    yes("dbDeploymentRunUnchanged", r.dbDeploymentRunUnchanged),
  ],
  "ac-034-cross-team-read-rejected": (r) => [eq("status", r.status, 403)],
  "ac-034-db-state": (r) => [
    yes("buildRunUnchanged", r.buildRunUnchanged),
    yes("deploymentRunUnchanged", r.deploymentRunUnchanged),
    eq("memberRole", r.memberRole, "member"),
    zero("outsiderMembership", r.outsiderMembership),
  ],
  "ac-035-secret-scan": (r) => [
    predicate(
      "requiredInventory",
      r.requiredArtifactCount > 0,
      r.requiredArtifactCount,
    ),
    zero("missingRequiredArtifacts", r.missingRequiredArtifacts?.length),
    zero("unexpectedHits", r.unexpectedHits),
    yes("passed", r.passed),
  ],
};
