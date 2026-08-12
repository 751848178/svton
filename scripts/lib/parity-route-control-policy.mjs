import { createHash } from "node:crypto";
import { validRouteDomains } from "./parity-route-control-domain.mjs";

export const EMPTY_ROUTE_STATE = { version: 1, operations: [], current: [] };
export const ROUTE_CAPABILITIES = { protocol: "site-route-control", version: 1,
  capabilities: { observeCurrent: true, expectedCurrentCas: true,
    compensation: true, clear: true } };

export function validateRouteControlState(value) {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.operations) ||
    !Array.isArray(value.current)) throw new Error("state_schema_invalid");
  const operations = value.operations.map(validateOperation);
  const current = value.current.map(validateCurrent);
  unique(operations.map((item) => item.operationId), "state_operation_duplicate");
  unique(current.map((item) => scopeKey(item.route)), "state_current_duplicate");
  assertDomainOwnership(current);
  return { version: 1, operations, current };
}

export function mutateRouteControlState(state, operationId, value, observedAt) {
  const request = validateMutation(value, operationId);
  const canonical = digest(request);
  const existing = state.operations.find((item) => item.operationId === operationId);
  if (existing) {
    if (existing.requestDigest !== canonical) throw conflict();
    return { state, operation: existing };
  }
  const next = structuredClone(state);
  const original = request.action
    ? next.operations.find((item) => item.operationId === request.originalOperationId)
    : undefined;
  if (request.action && !original) throw notFound();
  const scopeRoute = request.action ? original.route : request;
  const current = scopeRoute
    ? next.current.find((item) => scopeKey(item.route) === scopeKey(scopeRoute)) : null;
  if (!sameObservation(current?.observed ?? null, request.expectedCurrent)) throw conflict();
  const route = request.action ? request.desiredRoute : request;
  if (!scopeRoute || (route && scopeKey(route) !== scopeKey(scopeRoute))) throw conflict();
  replaceCurrent(next, scopeRoute, route, observedAt);
  assertDomainOwnership(next.current);
  const operation = { operationId, request, requestDigest: canonical, route,
    observedAt, observed: observation(route) };
  next.operations.push(operation);
  return { state: next, operation };
}

export function operationReadback(state, operationId) {
  const operation = state.operations.find((item) => item.operationId === operationId);
  if (!operation) throw notFound();
  return { observedAt: operation.observedAt, observed: operation.observed };
}

export function currentReadback(state, scope, observedAt) {
  const key = scopeKey(validateScope(scope));
  const current = state.current.find((item) => scopeKey(item.route) === key);
  return current ? { observedAt: current.observedAt, observed: current.observed,
    route: current.route } : { observedAt, observed: null, route: null };
}

function validateMutation(value, operationId) {
  if (!record(value) || value.version !== 1 || value.operationId !== operationId)
    throw new Error("operation_id_mismatch");
  if (value.action !== undefined) {
    if (!['restore', 'clear'].includes(value.action) || !text(value.originalOperationId) ||
      !observationValue(value.expectedCurrent)) throw new Error("compensation_invalid");
    const desiredRoute = value.desiredRoute === null ? null : validateRoute(value.desiredRoute);
    if ((value.action === "restore") !== Boolean(desiredRoute))
      throw new Error("compensation_action_invalid");
    return { version: 1, operationId, originalOperationId: value.originalOperationId,
      expectedCurrent: value.expectedCurrent, desiredRoute, action: value.action };
  }
  return validateRoute(value);
}

function validateRoute(value) {
  if (!record(value) || value.version !== 1) throw new Error("route_invalid");
  for (const key of ["operationId", "teamId", "projectId", "environmentId",
    "siteId", "deploymentRunId", "primaryDomain", "targetRef", "routeHash"])
    if (!text(value[key])) throw new Error(`invalid_${key}`);
  if (value.releaseRunId !== null && !text(value.releaseRunId))
    throw new Error("invalid_releaseRunId");
  if (!Array.isArray(value.entries) ||
    !validRouteDomains(value.domains, value.primaryDomain) ||
    !/^[a-f0-9]{64}$/.test(value.routeHash)) throw new Error("route_invalid");
  if (value.proxyTarget !== null) {
    const target = new URL(value.proxyTarget);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error("invalid_proxy_target");
    value = { ...value, proxyTarget: target.toString() };
  }
  if (value.expectedCurrent !== null && !observationValue(value.expectedCurrent))
    throw new Error("expected_current_invalid");
  return value;
}

function validateOperation(value) {
  if (!record(value) || !text(value.operationId) || !text(value.requestDigest) ||
    !validDate(value.observedAt) || !sameObservation(value.observed,
      observation(value.route))) throw new Error("state_operation_invalid");
  const request = validateMutation(value.request, value.operationId);
  if (digest(request) !== value.requestDigest) throw new Error("state_digest_invalid");
  return { ...value, request };
}
function validateCurrent(value) {
  const route = validateRoute(value?.route);
  if (!validDate(value.observedAt) || !sameObservation(value.observed, observation(route)))
    throw new Error("state_current_invalid");
  return { route, observedAt: value.observedAt, observed: observation(route) };
}
function replaceCurrent(state, scopeRoute, route, observedAt) {
  const key = scopeKey(scopeRoute);
  state.current = state.current.filter((item) => scopeKey(item.route) !== key);
  if (route) state.current.push({ route, observedAt, observed: observation(route) });
}
function assertDomainOwnership(current) {
  const owners = new Map();
  for (const item of current) for (const domain of item.route.domains) {
    const owner = owners.get(domain);
    if (owner && owner !== scopeKey(item.route)) throw conflict();
    owners.set(domain, scopeKey(item.route));
  }
}
function observation(route) { return route ? { siteId: route.siteId,
  deploymentRunId: route.deploymentRunId, targetRef: route.targetRef,
  routeHash: route.routeHash } : null; }
function observationValue(value) { return record(value) && ["siteId", "deploymentRunId",
  "targetRef", "routeHash"].every((key) => text(value[key])); }
function sameObservation(a, b) { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }
function validateScope(value) { if (!["teamId", "projectId", "environmentId", "siteId"]
  .every((key) => text(value[key]))) throw new Error("current_scope_invalid"); return value; }
function scopeKey(value) { return JSON.stringify([value.teamId, value.projectId,
  value.environmentId, value.siteId]); }
function digest(value) { return createHash("sha256").update(canonical(value)).digest("hex"); }
function canonical(value) { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function unique(values, reason) { if (new Set(values).size !== values.length) throw new Error(reason); }
function text(value) { return typeof value === "string" && value.length > 0 && value.length <= 512; }
function validDate(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function record(value) { return value && typeof value === "object" && !Array.isArray(value); }
function conflict() { return Object.assign(new Error("route_cas_conflict"), { statusCode: 409 }); }
function notFound() { return Object.assign(new Error("route_not_found"), { statusCode: 404 }); }
