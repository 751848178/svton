import {
  nonEmpty,
  requireEqual,
  requireIdentity,
  validTime,
} from "./parity-negative-history-identity-assert.mjs";
import { validateProductionRouteIdentity } from "./parity-negative-history-route-identity.mjs";
import { validateVersionRow } from "./parity-negative-history-version-row-identity.mjs";

export function validateProductionAction(result, roots, expected) {
  const label = `${expected.kind}-execute`;
  requireIdentity(nonEmpty(result.deploymentRunId), `${label}:deployment`);
  requireEqual(result.status, "completed", `${label}:status`);
  requireEqual(
    [result.environmentId, result.expectedEnvironmentId],
    [roots.productionEnvId, roots.productionEnvId],
    `${label}:environment`,
  );
  requireEqual(
    [result.manifestId, result.expectedManifestId],
    [expected.manifestId, expected.manifestId],
    `${label}:manifest`,
  );
  requireEqual(
    [result.releaseRunId, result.expectedReleaseRunId],
    [expected.releaseRunId, expected.releaseRunId],
    `${label}:release`,
  );
  const version = validateVersionRow(
    result,
    {
      kind: expected.kind,
      previousId: expected.previousVersionId,
      claimKey:
        expected.kind === "upgrade" ? "previousIsVprod1" : "previousIsVprod2",
      manifestId: expected.manifestId,
      deploymentRunId: result.deploymentRunId,
    },
    `${label}:version-row`,
  );
  requireEqual(
    [result.currentMoved, result.artifactVerified],
    [true, true],
    `${label}:claims`,
  );
  requireEqual(
    [
      result.releaseRun?.status,
      result.releaseRun?.mode,
      result.releaseRun?.approvalStatus,
    ],
    [
      "succeeded",
      expected.kind === "upgrade" ? "standard" : "recovery",
      "approved",
    ],
    `${label}:release-state`,
  );
  requireIdentity(
    validTime(result.releaseRun?.approvalConsumedAt),
    `${label}:consumed`,
  );
  validateGateRoots(result, roots, expected);
  validateProductionRouteIdentity(result, roots, expected);
  requireEqual(
    result.gateDecision,
    result.productionGate.resultGate,
    `${label}:gate-copy`,
  );
  requireEqual(
    result.siteProbe,
    result.routeEvidence.siteProbe,
    `${label}:probe-copy`,
  );
  requireEqual(
    result.routeSwitch,
    result.routeEvidence.deploymentRouteSwitch,
    `${label}:route-copy`,
  );
  return {
    result,
    deploymentRunId: result.deploymentRunId,
    versionId: version.id,
  };
}

function validateGateRoots(result, roots, expected) {
  const finalGateKey = `final:${expected.releaseRunId}:${result.deploymentRunId}`;
  requireEqual(
    result.productionGate?.expected,
    {
      releaseOrderId: roots.orderId,
      releaseRunId: expected.releaseRunId,
      deploymentRunId: result.deploymentRunId,
      environmentId: roots.productionEnvId,
      manifestId: expected.manifestId,
      buildRunId: expected.buildRunId,
      configRevisionId: roots.productionConfigRevisionId,
      finalGateKey,
      deploymentReleaseRunId: expected.releaseRunId,
      deploymentEnvironmentId: roots.productionEnvId,
      deploymentManifestId: expected.manifestId,
    },
    `${expected.kind}-execute:gate-roots`,
  );
}
