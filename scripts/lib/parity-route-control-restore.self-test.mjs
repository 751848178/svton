#!/usr/bin/env node
import assert from "node:assert/strict";
import { restoreRouteControlRoute } from "./parity-route-control-restore.mjs";

const token = "route-control-restore-token-0000000000000000";
const evidence = {
  operationId: "site-route:restore",
  teamId: "team",
  projectId: "project",
  environmentId: "environment",
  siteId: "site",
  deploymentRunId: "deployment",
  releaseRunId: "release",
  targetRef: "target",
  routeHash: "a".repeat(64),
  primaryDomain: "parity.example.test",
  domains: ["parity.example.test"],
  proxyTarget: "http://target-workload/",
};
const calls = [];
const fetchImpl = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || "GET" });
  if (options.method === "PUT") return new Response(null, { status: 204 });
  if (String(url).includes("/v1/routes/")) {
    return Response.json({
      observedAt: new Date().toISOString(),
      observed: {
        siteId: evidence.siteId,
        deploymentRunId: evidence.deploymentRunId,
        targetRef: evidence.targetRef,
        routeHash: evidence.routeHash,
      },
    });
  }
  return new Response("Parity Target Workload", {
    status: 200,
    headers: { "x-route-control-upstream": "http://target-workload" },
  });
};

const restored = await restoreRouteControlRoute({
  origin: "http://127.0.0.1:45993",
  token,
  evidence,
  fetchImpl,
});
assert.deepEqual(calls.map((call) => call.method), ["PUT", "GET", "GET"]);
assert.equal(restored.putStatus, 204);
assert.equal(restored.operationId, evidence.operationId);
assert.equal(restored.routeHash, evidence.routeHash);
assert.equal(restored.liveProxy.statusCode, 200);
assert.equal(restored.liveProxy.bodyMarker, "Parity Target Workload");
assert.equal(JSON.stringify(restored).includes(token), false);

await assert.rejects(
  restoreRouteControlRoute({
    origin: "http://route-control:45993",
    token,
    evidence,
    fetchImpl,
  }),
  /ROUTE_CONTROL_RESTORE_ORIGIN_INVALID/,
);

process.stdout.write("route-control restore self-test passed\n");
