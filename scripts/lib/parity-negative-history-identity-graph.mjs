import { freezeIdentity } from "./parity-negative-history-identity-assert.mjs";
import { validateGeneratedRoleDistinctness } from "./parity-negative-history-role-distinctness.mjs";
import { validateProductionIdentity } from "./parity-negative-history-production-identity.mjs";
import { validateStagingIdentity } from "./parity-negative-history-staging-identity.mjs";
import { validateHistorySummary } from "./parity-negative-history-summary-identity.mjs";

export function validateHistoryIdentityGraph(steps, baseAnchors) {
  const staging = validateStagingIdentity(steps, baseAnchors);
  const production = validateProductionIdentity(steps, staging);
  validateGeneratedRoleDistinctness(production);
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
