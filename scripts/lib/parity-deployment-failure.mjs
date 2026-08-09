const EXTERNAL_FAILURES = new Set([
  "SITE_DNS_PROBE_UNAVAILABLE",
  "SITE_TLS_PROBE_UNAVAILABLE",
  "SITE_HTTP_PROBE_UNAVAILABLE",
]);

export function productionDeploymentFailure(row) {
  const deploymentFailure = buildProductionDeploymentFailure(row);
  const error = new Error(
    `production deploy failed: run=${deploymentFailure.deploymentRunId || "unknown"}` +
      ` status=${deploymentFailure.status || "unknown"}` +
      ` code=${deploymentFailure.failureCode}` +
      ` externalSignoffRequired=${deploymentFailure.externalSignoffRequired}`,
  );
  error.deploymentFailure = deploymentFailure;
  return error;
}

export function parityDeploymentErrorEvidence(error) {
  if (!record(error) || !record(error.deploymentFailure)) return null;
  return buildProductionDeploymentFailure(error.deploymentFailure);
}

export function buildProductionDeploymentFailure(row) {
  const source = record(row) ? row : {};
  const result = record(source.result) ? source.result : source;
  const route = record(result.routeSwitch) ? result.routeSwitch : {};
  const receipt = record(route.receipt) ? route.receipt : {};
  const observed = record(receipt.observed) ? receipt.observed : {};
  const probe = record(result.siteProbe) ? result.siteProbe : {};
  const failureCode = deploymentFailureCode(route, probe);
  return {
    deploymentRunId: text(source.id ?? source.deploymentRunId),
    status: text(source.status),
    environmentId: text(source.environmentId),
    artifactManifestId: text(source.artifactManifestId),
    releaseRunId: text(source.releaseRunId),
    failureCode,
    storedError: text(source.error ?? source.storedError),
    externalSignoffRequired: EXTERNAL_FAILURES.has(failureCode),
    routeSwitch: {
      status: text(route.status),
      reasonCode: text(route.reasonCode),
      providerKey: text(route.providerKey),
      operationId: text(route.operationId),
      deploymentRunId: text(route.deploymentRunId),
      releaseRunId: text(route.releaseRunId),
      siteId: text(route.siteId),
      routeHash: text(route.routeHash),
      targetRef: text(route.targetRef),
      receipt: {
        status: text(receipt.status),
        reasonCode: text(receipt.reasonCode),
        providerKey: text(receipt.providerKey),
        operationId: text(receipt.operationId),
        deploymentRunId: text(
          observed.deploymentRunId ?? receipt.deploymentRunId,
        ),
        routeHash: text(observed.routeHash ?? receipt.routeHash),
      },
    },
    siteProbe: safeProbe(probe),
    gateDecision: safeGateDecision(result.gateDecision),
  };
}

function deploymentFailureCode(route, probe) {
  if (route.status !== "switched") return "SITE_ROUTE_SWITCH_UNVERIFIED";
  if (!text(probe.finalUrl)) return "SITE_FINAL_URL_MISSING";
  if (probe.dns?.status !== "resolved") return "SITE_DNS_PROBE_UNAVAILABLE";
  if (
    String(probe.finalUrl).startsWith("https:") &&
    probe.tls?.status !== "valid"
  ) {
    return probe.tls?.status === "invalid"
      ? "SITE_TLS_CERTIFICATE_INVALID"
      : "SITE_TLS_PROBE_UNAVAILABLE";
  }
  if (probe.http?.status !== "passed") {
    return probe.http?.status === "unavailable"
      ? "SITE_HTTP_PROBE_UNAVAILABLE"
      : "SITE_HTTP_PROBE_FAILED";
  }
  const statusCode = probe.http?.statusCode;
  return Number.isInteger(statusCode) && statusCode >= 200 && statusCode < 300
    ? "PRODUCTION_DEPLOYMENT_FAILED"
    : "SITE_HTTP_STATUS_INVALID";
}

function safeProbe(value) {
  const dns = record(value.dns) ? value.dns : {};
  const tls = record(value.tls) ? value.tls : {};
  const http = record(value.http) ? value.http : {};
  return {
    finalUrl: text(value.finalUrl),
    primaryDomain: text(value.primaryDomain),
    dns: probeStage(dns, { hostname: text(dns.hostname) }),
    tls: probeStage(tls, { host: text(tls.host), port: integer(tls.port) }),
    http: probeStage(http, {
      url: text(http.url),
      finalUrl: text(http.finalUrl),
      statusCode: integer(http.statusCode),
      bodySignature: text(http.bodySignature),
    }),
  };
}

function probeStage(value, identity) {
  const failure = record(value.error) ? value.error : {};
  return {
    status: text(value.status),
    ...identity,
    errorCode: text(failure.code ?? value.errorCode),
  };
}

function safeGateDecision(value) {
  const gate = record(value) ? value : {};
  return {
    id: text(gate.id),
    stage: text(gate.stage),
    inputHash: text(gate.inputHash),
  };
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.length <= 512 ? value : null;
}

function integer(value) {
  return Number.isInteger(value) ? value : null;
}
