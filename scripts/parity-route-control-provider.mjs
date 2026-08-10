import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import {
  requestRouteHostname,
  validRouteDomains,
} from "./lib/parity-route-control-domain.mjs";
import { routeControlUpstreamUrl } from "./lib/parity-route-control-upstream.mjs";

const MAX_BODY_BYTES = 64 * 1024;

export function createRouteControlServer({ token, fetchImpl = fetch }) {
  if (typeof token !== "string" || token.length < 32) {
    throw new Error("ROUTE_CONTROL_TOKEN must contain at least 32 characters");
  }
  const routes = new Map();
  const activeSites = new Map();
  const activeDomains = new Map();

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://route-control.local");
      if (request.method === "GET" && url.pathname === "/health") {
        return json(response, 200, { status: "ok" });
      }
      const routeMatch = url.pathname.match(/^\/v1\/routes\/([^/]+)$/);
      if (routeMatch) {
        if (!authorized(request.headers.authorization, token)) {
          return json(response, 401, { error: "unauthorized" });
        }
        const operationId = decodeURIComponent(routeMatch[1]);
        if (request.method === "PUT") {
          const input = validateRoute(await readJson(request), operationId);
          const observedAt = new Date().toISOString();
          const record = {
            input,
            observedAt,
            observed: observation(input),
          };
          routes.set(operationId, record);
          activeSites.set(input.siteId, record);
          for (const domain of input.domains) activeDomains.set(domain, record);
          return json(response, 204, null);
        }
        if (request.method === "GET") {
          const record = routes.get(operationId);
          return record
            ? json(response, 200, readback(record))
            : json(response, 404, { error: "route_not_found" });
        }
      }
      const domainRecord = activeDomains.get(requestRouteHostname(request));
      if (request.method === "GET" && domainRecord) {
        return await proxyRoute(
          response,
          domainRecord,
          `${url.pathname}${url.search}`,
          fetchImpl,
        );
      }
      const liveMatch = url.pathname.match(/^\/sites\/([^/]+)(\/.*)?$/);
      if (request.method === "GET" && liveMatch) {
        const siteId = decodeURIComponent(liveMatch[1]);
        const record = activeSites.get(siteId);
        if (!record)
          return json(response, 404, { error: "site_route_not_found" });
        return await proxyRoute(
          response,
          record,
          liveMatch[2] || "/",
          fetchImpl,
        );
      }
      return json(response, 404, { error: "not_found" });
    } catch (error) {
      return json(response, 400, { error: safeError(error) });
    }
  });
}

function validateRoute(value, operationId) {
  const input = objectValue(value);
  for (const key of [
    "operationId",
    "siteId",
    "deploymentRunId",
    "targetRef",
    "routeHash",
    "primaryDomain",
  ]) {
    if (
      typeof input[key] !== "string" ||
      !input[key] ||
      input[key].length > 512
    ) {
      throw new Error(`invalid_${key}`);
    }
  }
  if (input.operationId !== operationId)
    throw new Error("operation_id_mismatch");
  if (!/^[a-f0-9]{64}$/.test(input.routeHash))
    throw new Error("invalid_route_hash");
  if (!validRouteDomains(input.domains, input.primaryDomain)) {
    throw new Error("invalid_domains");
  }
  const target = new URL(input.proxyTarget);
  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error("invalid_proxy_target");
  }
  return { ...input, proxyTarget: target.toString() };
}

function observation(input) {
  return {
    siteId: input.siteId,
    deploymentRunId: input.deploymentRunId,
    targetRef: input.targetRef,
    routeHash: input.routeHash,
  };
}

function readback(record) {
  return { observedAt: record.observedAt, observed: record.observed };
}

async function proxyRoute(response, record, path, fetchImpl) {
  const upstream = routeControlUpstreamUrl(record.input.proxyTarget, path);
  const result = await fetchImpl(upstream, { redirect: "manual" });
  const body = new Uint8Array(await result.arrayBuffer());
  response.statusCode = result.status;
  response.setHeader(
    "content-type",
    result.headers.get("content-type") || "application/octet-stream",
  );
  response.setHeader("x-route-control-upstream", upstream.origin);
  response.setHeader("x-route-control-operation-id", record.input.operationId);
  response.setHeader("x-route-control-site-id", record.input.siteId);
  response.setHeader(
    "x-route-control-deployment-run-id",
    record.input.deploymentRunId,
  );
  if (record.input.releaseRunId) {
    response.setHeader(
      "x-route-control-release-run-id",
      record.input.releaseRunId,
    );
  }
  response.setHeader("x-route-control-route-hash", record.input.routeHash);
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function authorized(value, token) {
  const claimed = Buffer.from(value || "");
  const expected = Buffer.from(`Bearer ${token}`);
  return (
    claimed.length === expected.length && timingSafeEqual(claimed, expected)
  );
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function safeError(error) {
  return error instanceof Error ? error.message : "invalid_request";
}

function json(response, status, value) {
  response.statusCode = status;
  if (status === 204) return response.end();
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(value));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8080);
  const server = createRouteControlServer({
    token: process.env.ROUTE_CONTROL_TOKEN,
  });
  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(`route-control listening on ${port}\n`);
  });
}
