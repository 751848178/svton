const TEAM_ID = "parity-team-0001";
const PROJECT_ID = "parity-project-0001";
const ENVIRONMENT_ID = "parity-env-production";
const PROVIDER_KEY = "http-route-control-v1";

const ROUTE_SELECT = Object.freeze({
  id: true,
  teamId: true,
  siteId: true,
  projectId: true,
  environmentId: true,
  deploymentRunId: true,
  releaseRunId: true,
  targetRef: true,
  proxyTarget: true,
  domains: true,
  status: true,
  reasonCode: true,
  result: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
});

export function isolatedC5RouteQueryFor(identity) {
  requireIdentity(identity);
  return {
    where: {
      teamId: TEAM_ID,
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_ID,
      deploymentRunId: identity.deploymentRunId,
      releaseRunId: identity.releaseRunId,
      status: "switched",
    },
    orderBy: { createdAt: "desc" },
    select: ROUTE_SELECT,
  };
}

export function routeExpectationFromDatabaseRow(row, expectedIdentity) {
  if (!row) throw databaseError("route-run-missing");
  requireIdentity(expectedIdentity);
  const route = record(record(row.result).routeSwitch);
  const receipt = record(route.receipt);
  const observed = record(receipt.observed);
  const pairs = [
    [row.teamId, TEAM_ID, "row-team"],
    [row.projectId, PROJECT_ID, "row-project"],
    [row.environmentId, ENVIRONMENT_ID, "row-environment"],
    [row.status, "switched", "row-status"],
    [
      row.deploymentRunId,
      expectedIdentity.deploymentRunId,
      "history-deployment",
    ],
    [row.releaseRunId, expectedIdentity.releaseRunId, "history-release"],
    [row.reasonCode, "site_route_switched", "row-reason"],
    [route.teamId, row.teamId, "route-team"],
    [route.projectId, row.projectId, "route-project"],
    [route.environmentId, row.environmentId, "route-environment"],
    [route.siteId, row.siteId, "route-site"],
    [route.deploymentRunId, row.deploymentRunId, "route-deployment"],
    [route.releaseRunId, row.releaseRunId, "route-release"],
    [route.targetRef, row.targetRef, "route-target"],
    [route.proxyTarget, row.proxyTarget, "route-proxy-target"],
    [route.providerKey, PROVIDER_KEY, "route-provider"],
    [route.status, "switched", "route-status"],
    [route.reasonCode, "site_route_switched", "route-reason"],
    [receipt.version, 1, "receipt-version"],
    [receipt.operationId, route.operationId, "receipt-operation"],
    [receipt.providerKey, PROVIDER_KEY, "receipt-provider"],
    [receipt.status, "switched", "receipt-status"],
    [receipt.reasonCode, "site_route_switched", "receipt-reason"],
    [receipt.observedAt, route.switchedAt, "receipt-time"],
    [observed.siteId, row.siteId, "observed-site"],
    [observed.deploymentRunId, row.deploymentRunId, "observed-deployment"],
    [observed.targetRef, row.targetRef, "observed-target"],
    [observed.routeHash, route.routeHash, "observed-hash"],
  ];
  for (const [actual, expected, reason] of pairs) {
    if (actual === null || actual === undefined || actual !== expected) {
      throw databaseError(reason);
    }
  }
  const operationId = `site-route:${row.deploymentRunId}:${route.routeHash}`;
  if (
    route.operationId !== operationId ||
    !/^[a-f0-9]{64}$/.test(route.routeHash)
  ) {
    throw databaseError("route-operation-hash");
  }
  if (!Number.isFinite(Date.parse(route.switchedAt))) {
    throw databaseError("route-time");
  }
  return {
    operationId,
    siteId: row.siteId,
    deploymentRunId: row.deploymentRunId,
    targetRef: row.targetRef,
    routeHash: route.routeHash,
    proxyTarget: row.proxyTarget,
  };
}

function requireIdentity(identity) {
  for (const field of ["deploymentRunId", "releaseRunId"]) {
    if (
      typeof identity?.[field] !== "string" ||
      identity[field].length < 3 ||
      identity[field].length > 191
    ) {
      throw databaseError(`history-${field}`);
    }
  }
}

export function databaseRouteReadback(row) {
  const route = record(record(row.result).routeSwitch);
  return {
    routeRunId: row.id,
    teamId: row.teamId,
    projectId: row.projectId,
    environmentId: row.environmentId,
    siteId: row.siteId,
    deploymentRunId: row.deploymentRunId,
    releaseRunId: row.releaseRunId,
    targetRef: row.targetRef,
    proxyTarget: row.proxyTarget,
    domains: row.domains,
    status: row.status,
    reasonCode: row.reasonCode,
    operationId: route.operationId,
    providerKey: route.providerKey,
    observedAt: record(route.receipt).observedAt,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function databaseError(reason) {
  return new Error(`PARITY_C5_ROUTE_DATABASE_INVALID: ${reason}`);
}
