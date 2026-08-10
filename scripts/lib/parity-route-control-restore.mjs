import { captureRouteControlReadback } from "./parity-route-control-readback.mjs";

const STRING_FIELDS = [
  "operationId",
  "teamId",
  "projectId",
  "environmentId",
  "siteId",
  "deploymentRunId",
  "targetRef",
  "routeHash",
  "primaryDomain",
  "proxyTarget",
];

export async function restoreRouteControlRoute({
  origin,
  token,
  evidence,
  fetchImpl = fetch,
}) {
  const routeOrigin = requireLoopbackOrigin(origin);
  if (typeof token !== "string" || token.length < 32) {
    throw new Error("ROUTE_CONTROL_RESTORE_TOKEN_INVALID");
  }
  const input = restoreInput(evidence);
  const response = await fetchImpl(
    `${routeOrigin}/v1/routes/${encodeURIComponent(input.operationId)}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (response.status !== 204) {
    throw new Error(`ROUTE_CONTROL_RESTORE_FAILED:${response.status}`);
  }
  const readback = await captureRouteControlReadback({
    origin: routeOrigin,
    token,
    expected: input,
    fetchImpl,
  });
  return Object.freeze({
    putStatus: response.status,
    operationId: input.operationId,
    routeHash: input.routeHash,
    liveProxy: readback.liveProxy,
  });
}

function restoreInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ROUTE_CONTROL_RESTORE_EVIDENCE_INVALID");
  }
  const input = { version: 1 };
  for (const field of STRING_FIELDS) {
    if (typeof value[field] !== "string" || !value[field]) {
      throw new Error(`ROUTE_CONTROL_RESTORE_${field}_INVALID`);
    }
    input[field] = value[field];
  }
  if (!Array.isArray(value.domains) || value.domains.length === 0) {
    throw new Error("ROUTE_CONTROL_RESTORE_domains_INVALID");
  }
  input.domains = [...value.domains];
  if (typeof value.releaseRunId === "string" && value.releaseRunId) {
    input.releaseRunId = value.releaseRunId;
  }
  return input;
}

function requireLoopbackOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("ROUTE_CONTROL_RESTORE_ORIGIN_INVALID");
  }
  return url.origin;
}
