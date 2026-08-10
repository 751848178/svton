#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  isolatedC5RouteQueryFor,
  routeExpectationFromDatabaseRow,
} from "./parity-isolated-c5-route-database.mjs";

const row = validRow();
const historyIdentity = {
  teamId: "team-1",
  projectId: "fresh-project-1",
  environmentId: "fresh-production-1",
  deploymentRunId: "deployment-1",
  releaseRunId: "release-1",
};
const expected = routeExpectationFromDatabaseRow(row, historyIdentity);
assert.equal(expected.operationId, row.result.routeSwitch.operationId);
assert.equal(expected.siteId, "site-1");
assert.deepEqual(isolatedC5RouteQueryFor(historyIdentity).where, {
  teamId: "team-1",
  projectId: "fresh-project-1",
  environmentId: "fresh-production-1",
  deploymentRunId: "deployment-1",
  releaseRunId: "release-1",
  status: "switched",
});

for (const mutate of [
  (value) => {
    value.projectId = "other-project";
  },
  (value) => {
    value.result.routeSwitch.deploymentRunId = "other-run";
  },
  (value) => {
    value.result.routeSwitch.receipt.providerKey = "fake-provider";
  },
  (value) => {
    value.result.routeSwitch.routeHash = "b".repeat(64);
  },
]) {
  const changed = structuredClone(row);
  mutate(changed);
  assert.throws(
    () => routeExpectationFromDatabaseRow(changed, historyIdentity),
    /ROUTE_DATABASE_INVALID/,
  );
}
assert.throws(
  () =>
    routeExpectationFromDatabaseRow(row, {
      teamId: "team-1",
      projectId: "fresh-project-1",
      environmentId: "fresh-production-1",
      deploymentRunId: "other-deployment",
      releaseRunId: "release-1",
    }),
  /history-deployment/,
);

function validRow() {
  const routeHash = "a".repeat(64);
  const route = {
    operationId: `site-route:deployment-1:${routeHash}`,
    teamId: "team-1",
    projectId: "fresh-project-1",
    environmentId: "fresh-production-1",
    siteId: "site-1",
    deploymentRunId: "deployment-1",
    releaseRunId: "release-1",
    targetRef: "target-1",
    proxyTarget: "http://parity-target-workload",
    routeHash,
    providerKey: "http-route-control-v1",
    status: "switched",
    reasonCode: "site_route_switched",
    switchedAt: "2026-08-09T00:00:00.000Z",
  };
  route.receipt = {
    version: 1,
    operationId: route.operationId,
    providerKey: route.providerKey,
    status: route.status,
    reasonCode: "site_route_switched",
    observedAt: route.switchedAt,
    observed: {
      siteId: route.siteId,
      deploymentRunId: route.deploymentRunId,
      targetRef: route.targetRef,
      routeHash,
    },
  };
  return {
    id: "route-run-1",
    teamId: route.teamId,
    projectId: route.projectId,
    environmentId: route.environmentId,
    siteId: route.siteId,
    deploymentRunId: route.deploymentRunId,
    releaseRunId: route.releaseRunId,
    targetRef: route.targetRef,
    proxyTarget: route.proxyTarget,
    domains: ["parity.example.test"],
    status: route.status,
    reasonCode: "site_route_switched",
    result: { routeSwitch: route },
    createdAt: route.switchedAt,
    finishedAt: route.switchedAt,
  };
}

process.stdout.write("parity isolated C5 route audit self-test passed\n");
