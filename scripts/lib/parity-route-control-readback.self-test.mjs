#!/usr/bin/env node
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRouteControlServer } from "../parity-route-control-provider.mjs";
import { captureRouteControlReadback } from "./parity-route-control-readback.mjs";

const token = "route-control-readback-token-000000000000000000";
const target = createServer((_request, response) =>
  response.end("<h1>Parity Target Workload</h1>"),
);
await listen(target);
const provider = createRouteControlServer({ token });
await listen(provider);

try {
  const targetOrigin = `http://127.0.0.1:${target.address().port}`;
  const providerOrigin = `http://127.0.0.1:${provider.address().port}`;
  const expected = {
    operationId: `site-route:deployment:${"a".repeat(64)}`,
    siteId: "site-1",
    deploymentRunId: "deployment-1",
    targetRef: "target-1",
    routeHash: "a".repeat(64),
    proxyTarget: targetOrigin,
  };
  const apply = await fetch(
    `${providerOrigin}/v1/routes/${encodeURIComponent(expected.operationId)}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...expected,
        primaryDomain: "parity.example.test",
        domains: ["parity.example.test"],
      }),
    },
  );
  assert.equal(apply.status, 204);
  const receipt = await captureRouteControlReadback({
    origin: providerOrigin,
    token,
    expected,
  });
  assert.equal(receipt.resultIdentity.routeHash, expected.routeHash);
  assert.equal(receipt.liveProxy.statusCode, 200);
  assert.equal(receipt.liveProxy.upstreamOrigin, targetOrigin);
  assert.doesNotMatch(JSON.stringify(receipt), new RegExp(token));

  await assert.rejects(
    captureRouteControlReadback({
      origin: providerOrigin,
      token,
      expected: { ...expected, targetRef: "wrong-target" },
    }),
    /observed-targetRef/,
  );
  await assert.rejects(
    captureRouteControlReadback({
      origin: "http://parity.example.test:8080",
      token,
      expected,
    }),
    /origin-policy/,
  );
} finally {
  provider.close();
  target.close();
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}

process.stdout.write("parity route-control readback self-test passed\n");
