import { check, predicate } from "./parity-e2e-evidence.mjs";
import { productionGateEvidenceChecks } from "./parity-production-gate-evidence.mjs";
import { productionRouteEvidenceChecks } from "./parity-production-route-evidence.mjs";

export const ACTION_HISTORY_STEP_CHECKS = {
  "staging-upgrade": (r) => versionActionChecks(r, "staging", "upgrade"),
  "staging-recovery": (r) => versionActionChecks(r, "staging", "recovery"),
  "production-preview": (r) => [
    predicate(
      "inputHash",
      /^[a-f0-9]{64}$/.test(r.inputHash || ""),
      r.inputHash,
    ),
    check("manifestFrozen", r.manifestFrozen, true),
    ...digestPairChecks(
      "manifestDigest",
      r.manifestDigest,
      r.expectedManifestDigest,
    ),
  ],
  "production-confirm": (r) =>
    releaseConfirmChecks(
      r,
      "standard",
      "project.release_order.deploy_production",
    ),
  "production-approve": (r) => approvalChecks(r),
  "production-upgrade-execute": (r) => productionActionChecks(r, "upgrade"),
  "production-recovery-preview": (r) => [
    predicate(
      "inputHash",
      /^[a-f0-9]{64}$/.test(r.inputHash || ""),
      r.inputHash,
    ),
    ...identityPairChecks(
      "sourceVersionId",
      r.sourceVersionId,
      r.expectedSourceVersionId,
    ),
    ...identityPairChecks(
      "sourceManifestId",
      r.sourceManifestId,
      r.expectedManifestId,
    ),
    ...digestPairChecks(
      "sourceManifestDigest",
      r.sourceManifestDigest,
      r.expectedManifestDigest,
    ),
  ],
  "production-recovery-confirm": (r) =>
    releaseConfirmChecks(
      r,
      "recovery",
      "project.release_order.deploy_production_recovery",
    ),
  "production-recovery-approve": (r) => approvalChecks(r),
  "production-recovery-execute": (r) => productionActionChecks(r, "recovery"),
};

function versionActionChecks(r, environment, kind) {
  return [
    predicate("deploymentRunId", Boolean(r.deploymentRunId), r.deploymentRunId),
    check("status", r.status, "completed"),
    ...identityPairChecks(
      "environmentId",
      r.environmentId,
      r.expectedEnvironmentId,
    ),
    ...identityPairChecks("manifestId", r.manifestId, r.expectedManifestId),
    predicate(
      "versionId",
      Boolean(r.newEnvironmentVersion?.id),
      r.newEnvironmentVersion?.id,
    ),
    check("versionKind", r.newEnvironmentVersion?.kind, kind),
    ...identityPairChecks(
      "previousVersionId",
      r.newEnvironmentVersion?.previousVersionId,
      r.expectedPreviousVersionId,
    ),
    check("currentMoved", r.currentMoved, true),
    check("artifactVerified", r.artifactVerified, true),
    predicate("environmentLabel", environment === "staging", environment),
  ];
}

function releaseConfirmChecks(r, mode, action) {
  return [
    predicate("releaseRunId", Boolean(r.releaseRunId), r.releaseRunId),
    check("status", r.status, "awaiting_approval"),
    check("mode", r.mode, mode),
    predicate("approvalId", Boolean(r.approvalId), r.approvalId),
    check("approvalStatus", r.approvalStatus, "pending"),
    check("approvalAction", r.approvalAction, action),
    ...identityPairChecks("manifestId", r.manifestId, r.expectedManifestId),
    ...digestPairChecks(
      "verifiedDigest",
      r.verifiedDigest,
      r.expectedManifestDigest,
    ),
  ];
}

function identityPairChecks(name, actual, expected) {
  return [
    predicate(name, nonEmptyString(actual), actual),
    predicate(`expected:${name}`, nonEmptyString(expected), expected),
    check(`${name}MatchesExpected`, actual, expected),
  ];
}

function digestPairChecks(name, actual, expected) {
  const sha256 = /^sha256:[a-f0-9]{64}$/;
  return [
    predicate(name, sha256.test(actual || ""), actual),
    predicate(`expected:${name}`, sha256.test(expected || ""), expected),
    check(`${name}MatchesExpected`, actual, expected),
  ];
}

function approvalChecks(r) {
  return [
    predicate("approvalId", Boolean(r.approvalId), r.approvalId),
    check("status", r.status, "approved"),
    predicate("reviewerId", Boolean(r.reviewerId), r.reviewerId),
    predicate("reviewedAt", validTime(r.reviewedAt), r.reviewedAt),
  ];
}

function productionActionChecks(r, kind) {
  return [
    predicate("deploymentRunId", Boolean(r.deploymentRunId), r.deploymentRunId),
    check("status", r.status, "completed"),
    check("environmentId", r.environmentId, r.expectedEnvironmentId),
    check("manifestId", r.manifestId, r.expectedManifestId),
    check("releaseRunId", r.releaseRunId, r.expectedReleaseRunId),
    check("versionKind", r.newEnvironmentVersion?.kind, kind),
    check(
      "previousVersionId",
      r.newEnvironmentVersion?.previousVersionId,
      r.expectedPreviousVersionId,
    ),
    check("currentMoved", r.currentMoved, true),
    check("releaseStatus", r.releaseRun?.status, "succeeded"),
    check(
      "releaseMode",
      r.releaseRun?.mode,
      kind === "upgrade" ? "standard" : "recovery",
    ),
    check("approvalStatus", r.releaseRun?.approvalStatus, "approved"),
    predicate(
      "approvalConsumedAt",
      validTime(r.releaseRun?.approvalConsumedAt),
      r.releaseRun?.approvalConsumedAt,
    ),
    check("artifactVerified", r.artifactVerified, true),
    predicate("workload", Boolean(r.workload), r.workload),
    check("healthProbe", r.healthProbe?.status, "passed"),
    ...productionGateEvidenceChecks(r.productionGate),
    ...productionRouteEvidenceChecks(r.routeEvidence),
  ];
}

function nonEmptyString(value) {
  return (
    typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  );
}

function validTime(value) {
  return (
    Boolean(value) &&
    Number.isFinite(
      Date.parse(value instanceof Date ? value.toISOString() : value),
    )
  );
}
