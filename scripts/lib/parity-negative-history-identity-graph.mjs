import {
  freezeIdentity,
  requireDistinct,
} from "./parity-negative-history-identity-assert.mjs";
import { validateProductionIdentity } from "./parity-negative-history-production-identity.mjs";
import { validateStagingIdentity } from "./parity-negative-history-staging-identity.mjs";
import { validateHistorySummary } from "./parity-negative-history-summary-identity.mjs";

export function validateHistoryIdentityGraph(steps, baseAnchors) {
  const staging = validateStagingIdentity(steps, baseAnchors);
  const production = validateProductionIdentity(steps, staging);
  requireDistinct(
    [
      production.buildRunId,
      production.buildRunB2,
      production.manifestId,
      production.manifestM2,
      production.stagingDeploymentRunId,
      production.stagingDeploymentRunD2,
      production.stagingDeploymentRunD3,
      production.stagingDeploymentRunD4,
      production.productionDeploymentRunD2,
      production.productionDeploymentRunD3,
      production.stagingCurrentVersionId,
      production.stagingVersionV2,
      production.stagingVersionV3,
      production.stagingVersionV4,
      production.productionCurrentVersionId,
      production.productionVersionV2,
      production.productionVersionV3,
      production.productionReleaseRunId,
      production.productionReleaseRunR2,
      production.productionReleaseRunR3,
      production.productionApprovalA2,
      production.productionApprovalA3,
    ],
    "graph:generated-role-ids",
  );
  validateHistorySummary(steps, production);
  return freezeIdentity({
    manifestM1: production.manifestId,
    manifestM1Digest: production.manifestDigest,
    buildRunM1: production.buildRunId,
    productionReleaseRunR1: production.productionReleaseRunId,
    manifestM2: production.manifestM2,
    manifestM2Digest: production.manifestM2Digest,
    buildRunM2: production.buildRunB2,
    historyIdentityGraphValid: true,
  });
}
