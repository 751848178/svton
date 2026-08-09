import { createHash } from "node:crypto";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const WORKLOAD_MARKER = "Parity Target Workload";

export async function captureRouteControlReadback({
  origin,
  token,
  expected,
  fetchImpl = fetch,
}) {
  const routeOrigin = requireLoopbackOrigin(origin);
  requireToken(token);
  const requestIdentity = requireExpected(expected);
  const routeUrl = `${routeOrigin}/v1/routes/${encodeURIComponent(requestIdentity.operationId)}`;
  const routeResponse = await fetchImpl(routeUrl, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000),
  });
  if (!routeResponse.ok)
    throw readbackError(`route-status:${routeResponse.status}`);
  const routeBody = await boundedText(routeResponse);
  const routeRecord = parseRecord(routeBody, "route-json");
  const observed = record(routeRecord.observed);
  requireObservation(routeRecord.observedAt, observed, requestIdentity);

  const liveUrl = `${routeOrigin}/sites/${encodeURIComponent(requestIdentity.siteId)}/`;
  const liveResponse = await fetchImpl(liveUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
  });
  const liveBody = await boundedText(liveResponse);
  const upstreamOrigin = liveResponse.headers.get("x-route-control-upstream");
  const expectedUpstreamOrigin = new URL(expected.proxyTarget).origin;
  if (
    liveResponse.status < 200 ||
    liveResponse.status >= 300 ||
    upstreamOrigin !== expectedUpstreamOrigin ||
    !liveBody.includes(WORKLOAD_MARKER)
  ) {
    throw readbackError("live-proxy-mismatch");
  }

  return Object.freeze({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    requestIdentity: {
      ...requestIdentity,
      routeControlOrigin: routeOrigin,
      tokenTransport: "authorization-header-not-persisted",
    },
    resultIdentity: {
      observedAt: routeRecord.observedAt,
      ...observed,
    },
    liveProxy: {
      url: liveUrl,
      statusCode: liveResponse.status,
      upstreamOrigin,
      bodySha256: `sha256:${createHash("sha256").update(liveBody).digest("hex")}`,
      bodyMarker: WORKLOAD_MARKER,
    },
  });
}

function requireLoopbackOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw readbackError("origin-policy");
  }
  return url.origin;
}

function requireToken(value) {
  if (typeof value !== "string" || value.length < 32) {
    throw readbackError("token-policy");
  }
}

function requireExpected(value) {
  const input = record(value);
  const result = {};
  for (const field of [
    "operationId",
    "siteId",
    "deploymentRunId",
    "targetRef",
    "routeHash",
  ]) {
    if (typeof input[field] !== "string" || !input[field]) {
      throw readbackError(`expected-${field}`);
    }
    result[field] = input[field];
  }
  if (!/^[a-f0-9]{64}$/.test(result.routeHash)) {
    throw readbackError("expected-routeHash-format");
  }
  const proxyTarget = new URL(input.proxyTarget);
  if (!["http:", "https:"].includes(proxyTarget.protocol)) {
    throw readbackError("expected-proxyTarget-protocol");
  }
  return result;
}

function requireObservation(observedAt, observed, expected) {
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw readbackError("observed-at");
  }
  for (const field of ["siteId", "deploymentRunId", "targetRef", "routeHash"]) {
    if (observed[field] !== expected[field]) {
      throw readbackError(`observed-${field}`);
    }
  }
}

async function boundedText(response) {
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_RESPONSE_BYTES)
    throw readbackError("response-size");
  return new TextDecoder().decode(body);
}

function parseRecord(value, reason) {
  try {
    return record(JSON.parse(value));
  } catch {
    throw readbackError(reason);
  }
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function readbackError(reason) {
  return new Error(`PARITY_ROUTE_CONTROL_READBACK_INVALID: ${reason}`);
}
