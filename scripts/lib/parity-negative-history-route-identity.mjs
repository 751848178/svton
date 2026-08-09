import { buildProductionRouteExpectation } from "./parity-production-route-evidence.mjs";
import {
  nonEmpty,
  requireEqual,
  requireIdentity,
} from "./parity-negative-history-identity-assert.mjs";

export function validateProductionRouteIdentity(result, roots, expected) {
  const label = `${expected.kind}-execute:route`;
  const proof = result.routeEvidence || {};
  const claimed = proof.expected || {};
  const siteId = claimed.siteId;
  const providerKey = claimed.providerKey;
  requireIdentity(nonEmpty(siteId), `${label}:site`);
  requireIdentity(
    nonEmpty(providerKey) && providerKey !== "unconfigured",
    `${label}:provider`,
  );
  const row = proof.routeRuns?.[0] || {};
  const persisted = proof.deploymentRouteSwitch || {};
  const observed = persisted.receipt?.observed || {};
  requireEqual(
    [row.siteId, proof.siteCurrent?.id, persisted.siteId, observed.siteId],
    [siteId, siteId, siteId, siteId],
    `${label}:site-copies`,
  );
  requireEqual(
    [persisted.providerKey, persisted.receipt?.providerKey],
    [providerKey, providerKey],
    `${label}:provider-copies`,
  );
  const rebuilt = buildProductionRouteExpectation({
    teamId: roots.teamId,
    projectId: roots.projectId,
    environmentId: roots.productionEnvId,
    deploymentRunId: result.deploymentRunId,
    releaseRunId: expected.releaseRunId,
    manifestId: expected.manifestId,
    configRevisionId: roots.productionConfigRevisionId,
    routeSnapshot: roots.productionRouteSnapshot,
    siteId,
    targetRef: roots.productionTargetRef,
    providerKey,
    receiptVersion: 1,
    finalSitePort: roots.finalSitePort,
  });
  requireEqual(claimed, rebuilt, `${label}:rebuilt`);
}
