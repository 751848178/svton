import { createServer } from "node:http";
import { requestRouteHostname } from "./lib/parity-route-control-domain.mjs";
import { authorized, readRouteControlJson, routeControlError, routeControlJson,
} from "./lib/parity-route-control-http.mjs";
import { currentReadback, mutateRouteControlState, operationReadback,
  ROUTE_CAPABILITIES } from "./lib/parity-route-control-policy.mjs";
import { createRouteControlStateStore } from "./lib/parity-route-control-state-store.mjs";
import { routeControlUpstreamUrl } from "./lib/parity-route-control-upstream.mjs";

export function createRouteControlServer({ token, stateFile, fetchImpl = fetch }) {
  if (typeof token !== "string" || token.length < 32)
    throw new Error("ROUTE_CONTROL_TOKEN must contain at least 32 characters");
  const store = createRouteControlStateStore(stateFile);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://route-control.local");
      if (request.method === "GET" && url.pathname === "/health") {
        const health = await store.health();
        return routeControlJson(response, health.status === "ok" ? 200 : 503, health);
      }
      const dataRoute = await resolveDataRoute(store, request, url);
      if (dataRoute) return await proxyRoute(response, dataRoute, dataRoute.path, fetchImpl);
      if (!authorized(request.headers.authorization, token))
        return routeControlJson(response, 401, { error: "unauthorized" });
      if (request.method === "GET" && url.pathname === "/v1/capabilities")
        return routeControlJson(response, 200, ROUTE_CAPABILITIES);
      if (request.method === "GET" && url.pathname === "/v1/routes/current") {
        const scope = Object.fromEntries(["teamId", "projectId", "environmentId", "siteId"]
          .map((key) => [key, url.searchParams.get(key)]));
        const value = await store.read((state) =>
          currentReadback(state, scope, new Date().toISOString()));
        return routeControlJson(response, 200, value);
      }
      const match = url.pathname.match(/^\/v1\/routes\/([^/]+)$/);
      if (!match) return routeControlJson(response, 404, { error: "not_found" });
      const operationId = decodeURIComponent(match[1]);
      if (request.method === "GET") {
        const value = await store.read((state) => operationReadback(state, operationId));
        return routeControlJson(response, 200, value);
      }
      if (request.method === "PUT") {
        const body = await readRouteControlJson(request);
        await store.mutate((state) => {
          const outcome = mutateRouteControlState(state, operationId, body,
            new Date().toISOString());
          return { state: outcome.state, value: outcome.operation };
        });
        return routeControlJson(response, 204, null);
      }
      return routeControlJson(response, 404, { error: "not_found" });
    } catch (error) { return routeControlError(response, error); }
  });
  server.routeControlReady = store.assertReady();
  return server;
}

async function resolveDataRoute(store, request, url) {
  if (request.method !== "GET" || url.pathname.startsWith("/v1/") ||
    url.pathname === "/health") return null;
  const host = requestRouteHostname(request);
  const live = url.pathname.match(/^\/sites\/([^/]+)(\/.*)?$/);
  return store.read((state) => {
    const current = state.current.find((item) => item.route.domains.includes(host)) ??
      (live ? state.current.find((item) =>
        item.route.siteId === decodeURIComponent(live[1])) : null);
    if (!current) return null;
    return { ...current, path: host ? `${url.pathname}${url.search}` : live[2] || "/" };
  });
}

async function proxyRoute(response, current, path, fetchImpl) {
  if (!current.route.proxyTarget) throw new Error("proxy_target_unavailable");
  const upstream = routeControlUpstreamUrl(current.route.proxyTarget, path);
  let result;
  try { result = await fetchImpl(upstream, { redirect: "manual" }); }
  catch { throw Object.assign(new Error("route_upstream_unavailable"), { statusCode: 502 }); }
  const body = new Uint8Array(await result.arrayBuffer());
  response.statusCode = result.status;
  response.setHeader("content-type", result.headers.get("content-type") ||
    "application/octet-stream");
  response.setHeader("x-route-control-upstream", upstream.origin);
  response.setHeader("x-route-control-operation-id", current.route.operationId);
  response.setHeader("x-route-control-site-id", current.route.siteId);
  response.setHeader("x-route-control-deployment-run-id", current.route.deploymentRunId);
  if (current.route.releaseRunId)
    response.setHeader("x-route-control-release-run-id", current.route.releaseRunId);
  response.setHeader("x-route-control-route-hash", current.route.routeHash);
  response.end(body);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8080);
  const server = createRouteControlServer({ token: process.env.ROUTE_CONTROL_TOKEN,
    stateFile: process.env.ROUTE_CONTROL_STATE_FILE });
  await server.routeControlReady;
  server.listen(port, "0.0.0.0", () =>
    process.stdout.write(`route-control acceptance provider listening on ${port}\n`));
}
