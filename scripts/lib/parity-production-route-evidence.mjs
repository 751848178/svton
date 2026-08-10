import { createHash } from "node:crypto";
import { check, predicate } from "./parity-e2e-evidence.mjs";

export function buildProductionRouteExpectation(input) {
  const route = input.routeSnapshot || {};
  const primaryDomain = route.domains?.[0];
  const domains = [...(route.domains || [])].sort();
  const tlsRequired = route.tlsRequired !== false;
  const finalSitePort = validPort(input.finalSitePort)
    ? `:${input.finalSitePort}`
    : "";
  const configuredFinalUrl = primaryDomain
    ? new URL(
        `${tlsRequired ? "https" : "http"}://${primaryDomain}${finalSitePort}`,
      ).toString()
    : null;
  const canonical = {
    siteId: input.siteId,
    primaryDomain,
    domains,
    proxyTarget: route.proxyTarget ?? null,
    targetRef: input.targetRef,
  };
  const routeHash = createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
  return {
    ...input,
    ...canonical,
    tlsRequired,
    configuredFinalUrl,
    routeHash,
    operationId: `site-route:${input.deploymentRunId}:${routeHash}`,
  };
}

export function productionRouteEvidence(input) {
  return input;
}

export function productionRouteEvidenceChecks(proof = {}) {
  const expected = proof.expected || {};
  const deployment = proof.deployment || {};
  const release = proof.releaseRun || {};
  const probe = proof.siteProbe || {};
  const routeRows = proof.routeRuns || [];
  const row = routeRows[0] || {};
  const persisted = row.result?.routeSwitch || {};
  const receipt = persisted.receipt || {};
  const observed = receipt.observed || {};
  return [
    predicate("expectedProviderKey", validProvider(expected.providerKey), expected.providerKey),
    check("expectedReceiptVersion", expected.receiptVersion, 1),
    predicate("expectedSiteId", Boolean(expected.siteId), expected.siteId),
    predicate("expectedPrimaryDomain", Boolean(expected.primaryDomain), expected.primaryDomain),
    predicate("expectedTargetRef", Boolean(expected.targetRef), expected.targetRef),
    predicate("expectedDomains", expected.domains?.length > 0, expected.domains),
    predicate("configuredFinalUrl", Boolean(expected.configuredFinalUrl), expected.configuredFinalUrl),
    predicate("routeHash", /^[a-f0-9]{64}$/.test(expected.routeHash || ""), expected.routeHash),
    check("releaseEnvironmentId", release.environmentId, expected.environmentId),
    check("releaseManifestId", release.artifactManifestId, expected.manifestId),
    check("releaseConfigRevisionId", release.configRevisionId, expected.configRevisionId),
    predicate("releaseRouteSnapshot", jsonEqual(release.routeSnapshot, expected.routeSnapshot), release.routeSnapshot),
    check("deploymentReleaseRunId", deployment.releaseRunId, expected.releaseRunId),
    check("deploymentEnvironmentId", deployment.environmentId, expected.environmentId),
    check("deploymentManifestId", deployment.artifactManifestId, expected.manifestId),
    check("siteCandidateCount", proof.siteCandidateCount, 1),
    check("siteId", proof.siteCurrent?.id, expected.siteId),
    check("sitePrimaryDomain", proof.siteCurrent?.primaryDomain, expected.primaryDomain),
    check("routeRunCount", routeRows.length, 1),
    check("routeRunTeamId", row.teamId, expected.teamId),
    check("routeRunProjectId", row.projectId, expected.projectId),
    check("routeRunEnvironmentId", row.environmentId, expected.environmentId),
    check("routeRunDeploymentRunId", row.deploymentRunId, expected.deploymentRunId),
    check("routeRunReleaseRunId", row.releaseRunId, expected.releaseRunId),
    check("routeRunSiteId", row.siteId, expected.siteId),
    check("routeRunTargetRef", row.targetRef, expected.targetRef),
    predicate("routeRunDomains", jsonEqual(sorted(row.domains), expected.domains), row.domains),
    check("routeRunProxyTarget", row.proxyTarget, expected.proxyTarget),
    check("routeRunStatus", row.status, "switched"),
    check("routeRunReasonCode", row.reasonCode, "site_route_switched"),
    predicate("routeRunFinishedAt", validTime(row.finishedAt), row.finishedAt),
    check("routeVersion", persisted.version, 1),
    check("routeOperationId", persisted.operationId, expected.operationId),
    check("routeHashPersisted", persisted.routeHash, expected.routeHash),
    check("routeProviderKey", persisted.providerKey, expected.providerKey),
    check("routeTeamId", persisted.teamId, expected.teamId),
    check("routeProjectId", persisted.projectId, expected.projectId),
    check("routeEnvironmentId", persisted.environmentId, expected.environmentId),
    check("routeSiteId", persisted.siteId, expected.siteId),
    check("routeDeploymentRunId", persisted.deploymentRunId, expected.deploymentRunId),
    check("routeReleaseRunId", persisted.releaseRunId, expected.releaseRunId),
    check("routePrimaryDomain", persisted.primaryDomain, expected.primaryDomain),
    predicate("routeDomains", jsonEqual(sorted(persisted.domains), expected.domains), persisted.domains),
    check("routeProxyTarget", persisted.proxyTarget, expected.proxyTarget),
    check("routeTargetRef", persisted.targetRef, expected.targetRef),
    check("routeStatus", persisted.status, "switched"),
    check("routeReasonCode", persisted.reasonCode, "site_route_switched"),
    check("receiptVersion", receipt.version, expected.receiptVersion),
    check("receiptProviderKey", receipt.providerKey, expected.providerKey),
    check("receiptOperationId", receipt.operationId, expected.operationId),
    check("receiptStatus", receipt.status, "switched"),
    check("receiptReasonCode", receipt.reasonCode, "site_route_switched"),
    predicate("receiptObservedAt", validTime(receipt.observedAt), receipt.observedAt),
    check("receiptObservedSiteId", observed.siteId, expected.siteId),
    check("receiptObservedDeploymentRunId", observed.deploymentRunId, expected.deploymentRunId),
    check("receiptObservedTargetRef", observed.targetRef, expected.targetRef),
    check("receiptObservedRouteHash", observed.routeHash, expected.routeHash),
    check("observedEqualsSwitchedAt", receipt.observedAt, persisted.switchedAt),
    predicate("observedAfterDeploymentStart", atOrAfter(receipt.observedAt, deployment.startedAt), receipt.observedAt),
    predicate("observedBeforeRouteFinish", atOrBefore(receipt.observedAt, row.finishedAt), receipt.observedAt),
    predicate("observedBeforeCapture", atOrBefore(receipt.observedAt, proof.capturedAt), receipt.observedAt),
    predicate("deploymentRouteMatches", jsonEqual(proof.deploymentRouteSwitch, persisted), proof.deploymentRouteSwitch),
    predicate("siteCurrentRouteMatches", jsonEqual(proof.siteCurrent?.routeSwitch, persisted), proof.siteCurrent?.routeSwitch),
    predicate("routeRunProbeMatches", jsonEqual(row.result?.siteProbe, probe), row.result?.siteProbe),
    check("probePrimaryDomain", probe.primaryDomain, expected.primaryDomain),
    check("probeFinalUrl", probe.finalUrl, expected.configuredFinalUrl),
    check("probeHttpUrl", probe.http?.url, expected.configuredFinalUrl),
    check("probeHttpFinalUrl", probe.http?.finalUrl, expected.configuredFinalUrl),
    check("probeHttpStatus", probe.http?.status, "passed"),
    predicate("probeHttpStatusCode", probe.http?.statusCode >= 200 && probe.http?.statusCode < 300, probe.http?.statusCode),
    predicate("probeBodySignature", Boolean(probe.http?.bodySignature), probe.http?.bodySignature),
    predicate("probeTls", tlsChecksPass(probe.tls, expected), probe.tls),
  ];
}

function tlsChecksPass(tls, expected) {
  if (!expected.tlsRequired) return true;
  return tls?.status === "valid" && tls.host === expected.primaryDomain &&
    tls.servername === expected.primaryDomain && tls.authorized === true &&
    tls.authorizationErrorCode === null;
}

function validProvider(value) {
  return typeof value === "string" && value.length > 0 && value !== "unconfigured";
}

function validPort(value) {
  return Number.isSafeInteger(value) && value >= 1024 && value <= 65535;
}

function validTime(value) {
  return (value instanceof Date && Number.isFinite(value.getTime())) ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function atOrAfter(value, lower) {
  return validTime(value) && validTime(lower) && new Date(value).getTime() >= new Date(lower).getTime();
}

function atOrBefore(value, upper) {
  return validTime(value) && validTime(upper) && new Date(value).getTime() <= new Date(upper).getTime();
}

function sorted(value) {
  return Array.isArray(value) ? [...value].sort() : value;
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
