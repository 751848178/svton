#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildProductionRouteExpectation,
  productionRouteEvidenceChecks,
} from "./parity-production-route-evidence.mjs";

const proof = validProof();
assert.deepEqual(failed(proof), []);

for (const [label, mutate] of [
  ["wrong configured final URL", (value) => {
    value.siteProbe.finalUrl = "https://wrong.example.test/";
    value.siteProbe.http.url = "https://wrong.example.test/";
    value.siteProbe.http.finalUrl = "https://wrong.example.test/";
  }],
  ["other deployment run", (value) => { value.routeRuns[0].deploymentRunId = "deployment-other"; }],
  ["other release run", (value) => { value.routeRuns[0].releaseRunId = "release-other"; }],
  ["other site", (value) => { value.routeRuns[0].siteId = "site-other"; }],
  ["other target", (value) => { value.routeRuns[0].targetRef = "target-other"; }],
  ["route hash drift", (value) => { route(value).routeHash = "b".repeat(64); }],
  ["provider drift", (value) => { receipt(value).providerKey = "provider-other"; }],
  ["receipt version drift", (value) => { receipt(value).version = 2; }],
  ["missing receipt", (value) => { route(value).receipt = true; }],
  ["readback site drift", (value) => { receipt(value).observed.siteId = "site-other"; }],
  ["readback deployment drift", (value) => { receipt(value).observed.deploymentRunId = "deployment-other"; }],
  ["readback target drift", (value) => { receipt(value).observed.targetRef = "target-other"; }],
  ["readback hash drift", (value) => { receipt(value).observed.routeHash = "c".repeat(64); }],
  ["invalid observedAt", (value) => { receipt(value).observedAt = "not-a-time"; }],
  ["future observedAt", (value) => {
    const future = "2026-08-08T00:10:00.000Z";
    receipt(value).observedAt = future;
    route(value).switchedAt = future;
    syncRouteCopies(value);
  }],
  ["zero exact route rows", (value) => { value.routeRuns = []; }],
  ["multiple exact route rows", (value) => { value.routeRuns.push(structuredClone(value.routeRuns[0])); }],
  ["site current mismatch", (value) => { value.siteCurrent.routeSwitch.operationId = "site-route:stale"; }],
  ["deployment result mismatch", (value) => { value.deploymentRouteSwitch.routeHash = "d".repeat(64); }],
]) {
  const mutated = structuredClone(proof);
  mutate(mutated);
  assert.ok(failed(mutated).length > 0, `${label} was accepted`);
}

function validProof() {
  const routeSnapshot = {
    domains: ["production.example.test"],
    proxyTarget: "http://target-workload",
    tlsRequired: true,
  };
  const expected = buildProductionRouteExpectation({
    teamId: "team-1",
    projectId: "project-1",
    environmentId: "production-1",
    deploymentRunId: "deployment-1",
    releaseRunId: "release-1",
    manifestId: "manifest-1",
    configRevisionId: "config-2",
    routeSnapshot,
    siteId: "site-1",
    targetRef: "target-1",
    providerKey: "route-provider-v1",
    receiptVersion: 1,
  });
  const observedAt = "2026-08-08T00:00:05.000Z";
  const receiptValue = {
    version: 1,
    providerKey: expected.providerKey,
    operationId: expected.operationId,
    status: "switched",
    reasonCode: "site_route_switched",
    observedAt,
    observed: {
      siteId: expected.siteId,
      deploymentRunId: expected.deploymentRunId,
      targetRef: expected.targetRef,
      routeHash: expected.routeHash,
    },
  };
  const routeSwitch = {
    version: 1,
    operationId: expected.operationId,
    teamId: expected.teamId,
    projectId: expected.projectId,
    environmentId: expected.environmentId,
    siteId: expected.siteId,
    deploymentRunId: expected.deploymentRunId,
    releaseRunId: expected.releaseRunId,
    primaryDomain: expected.primaryDomain,
    domains: expected.domains,
    proxyTarget: expected.proxyTarget,
    targetRef: expected.targetRef,
    routeHash: expected.routeHash,
    providerKey: expected.providerKey,
    status: "switched",
    reasonCode: "site_route_switched",
    switchedAt: observedAt,
    receipt: receiptValue,
  };
  const siteProbe = {
    primaryDomain: expected.primaryDomain,
    finalUrl: expected.configuredFinalUrl,
    http: {
      url: expected.configuredFinalUrl,
      finalUrl: expected.configuredFinalUrl,
      status: "passed",
      statusCode: 200,
      bodySignature: "sha256:body",
    },
    tls: {
      status: "valid",
      host: expected.primaryDomain,
      servername: expected.primaryDomain,
      authorized: true,
      authorizationErrorCode: null,
    },
  };
  return {
    expected,
    deployment: {
      releaseRunId: expected.releaseRunId,
      environmentId: expected.environmentId,
      artifactManifestId: expected.manifestId,
      startedAt: "2026-08-08T00:00:00.000Z",
      finishedAt: "2026-08-08T00:00:06.000Z",
    },
    releaseRun: {
      environmentId: expected.environmentId,
      artifactManifestId: expected.manifestId,
      configRevisionId: expected.configRevisionId,
      routeSnapshot,
    },
    siteCandidateCount: 1,
    siteCurrent: {
      id: expected.siteId,
      primaryDomain: expected.primaryDomain,
      routeSwitch: structuredClone(routeSwitch),
    },
    routeRuns: [{
      teamId: expected.teamId,
      siteId: expected.siteId,
      projectId: expected.projectId,
      environmentId: expected.environmentId,
      deploymentRunId: expected.deploymentRunId,
      releaseRunId: expected.releaseRunId,
      targetRef: expected.targetRef,
      proxyTarget: expected.proxyTarget,
      domains: expected.domains,
      status: "switched",
      reasonCode: "site_route_switched",
      result: { routeSwitch, siteProbe },
      startedAt: observedAt,
      finishedAt: observedAt,
    }],
    siteProbe: structuredClone(siteProbe),
    deploymentRouteSwitch: structuredClone(routeSwitch),
    capturedAt: "2026-08-08T00:00:07.000Z",
  };
}

function route(value) {
  return value.routeRuns[0].result.routeSwitch;
}

function receipt(value) {
  return route(value).receipt;
}

function syncRouteCopies(value) {
  value.deploymentRouteSwitch = structuredClone(route(value));
  value.siteCurrent.routeSwitch = structuredClone(route(value));
}

function failed(value) {
  return productionRouteEvidenceChecks(value).filter((item) => item.pass !== true);
}

process.stdout.write("production route evidence self-test passed\n");
