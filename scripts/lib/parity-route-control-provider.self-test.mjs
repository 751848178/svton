import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { once } from "node:events";
import { createRouteControlServer } from "../parity-route-control-provider.mjs";

const token = "route-control-self-test-token-0000000000000000";
const target = createServer((_request, response) =>
  response.end("live-route-ok"),
);
await listen(target);

const targetPort = target.address().port;
const provider = createRouteControlServer({ token });
await listen(provider);
const providerPort = provider.address().port;

try {
  const input = {
    version: 1,
    operationId: `site-route:deployment:${"a".repeat(64)}`,
    teamId: "team",
    projectId: "project",
    environmentId: "environment",
    siteId: "site",
    deploymentRunId: "deployment",
    releaseRunId: "release",
    primaryDomain: "parity.example.test",
    domains: ["parity.example.test"],
    proxyTarget: `http://127.0.0.1:${targetPort}/`,
    targetRef: "filesystem-release-target",
    routeHash: "a".repeat(64),
  };
  const routeUrl = `http://127.0.0.1:${providerPort}/v1/routes/${encodeURIComponent(input.operationId)}`;
  assert.equal((await fetch(routeUrl, { method: "GET" })).status, 401);
  assert.equal(
    (
      await fetch(routeUrl, {
        method: "PUT",
        headers: authorizationHeaders(),
        body: JSON.stringify(input),
      })
    ).status,
    204,
  );
  const readback = await (
    await fetch(routeUrl, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  assert.deepEqual(readback.observed, {
    siteId: input.siteId,
    deploymentRunId: input.deploymentRunId,
    targetRef: input.targetRef,
    routeHash: input.routeHash,
  });
  assert.ok(Number.isFinite(Date.parse(readback.observedAt)));

  const domainLive = await requestDomain(
    providerPort,
    `parity.example.test:${providerPort}`,
  );
  assert.equal(domainLive.statusCode, 200);
  assert.equal(domainLive.body, "live-route-ok");
  assert.equal(
    domainLive.headers["x-route-control-operation-id"],
    input.operationId,
  );
  assert.equal(domainLive.headers["x-route-control-site-id"], input.siteId);
  assert.equal(
    domainLive.headers["x-route-control-deployment-run-id"],
    input.deploymentRunId,
  );
  assert.equal(
    domainLive.headers["x-route-control-release-run-id"],
    input.releaseRunId,
  );
  assert.equal(
    domainLive.headers["x-route-control-route-hash"],
    input.routeHash,
  );

  const live = await fetch(`http://127.0.0.1:${providerPort}/sites/site/path`);
  assert.equal(live.status, 200);
  assert.equal(await live.text(), "live-route-ok");
  assert.equal(
    live.headers.get("x-route-control-upstream"),
    `http://127.0.0.1:${targetPort}`,
  );

  const rejected = {
    ...input,
    operationId: `site-route:failed:${"b".repeat(64)}`,
    siteId: "failed-site",
    deploymentRunId: "failed-deployment",
    proxyTarget: "http://127.0.0.1:1/",
    routeHash: "b".repeat(64),
  };
  const rejectedUrl = `http://127.0.0.1:${providerPort}/v1/routes/${encodeURIComponent(rejected.operationId)}`;
  assert.equal(
    (
      await fetch(rejectedUrl, {
        method: "PUT",
        headers: authorizationHeaders(),
        body: JSON.stringify(rejected),
      })
    ).status,
    204,
  );
  const failedLive = await fetch(
    `http://127.0.0.1:${providerPort}/sites/failed-site/`,
  );
  assert.equal(failedLive.status, 400);
  assert.equal(
    (
      await fetch(rejectedUrl, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
    200,
  );
} finally {
  provider.close();
  target.close();
}

function authorizationHeaders() {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}

function requestDomain(port, host) {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: "127.0.0.1", port, path: "/domain-path", headers: { host } },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

process.stdout.write("parity-route-control-provider self-test passed\n");
