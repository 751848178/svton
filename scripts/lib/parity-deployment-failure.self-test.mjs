#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  parityDeploymentErrorEvidence,
  productionDeploymentFailure,
} from "./parity-deployment-failure.mjs";
import { checkedStep } from "./parity-e2e-evidence.mjs";

const secret = "DO-NOT-PERSIST-SECRET";
const row = fixture();
const error = productionDeploymentFailure(row);
const evidence = parityDeploymentErrorEvidence(error);

assert.match(error.message, /code=SITE_DNS_PROBE_UNAVAILABLE/);
assert.equal(evidence.deploymentRunId, "deploy-1");
assert.equal(evidence.failureCode, "SITE_DNS_PROBE_UNAVAILABLE");
assert.equal(evidence.externalSignoffRequired, true);
assert.equal(evidence.routeSwitch.operationId, "operation-1");
assert.equal(evidence.routeSwitch.receipt.deploymentRunId, "deploy-1");
assert.equal(evidence.siteProbe.dns.errorCode, "SITE_PROBE_ADDRESS_FORBIDDEN");
assert.equal(evidence.gateDecision.inputHash, "a".repeat(64));
assert.equal(JSON.stringify(evidence).includes(secret), false);
assert.deepEqual(Object.keys(evidence).sort(), [
  "artifactManifestId",
  "deploymentRunId",
  "environmentId",
  "externalSignoffRequired",
  "failureCode",
  "gateDecision",
  "releaseRunId",
  "routeSwitch",
  "siteProbe",
  "status",
  "storedError",
]);

const workloadError = productionDeploymentFailure({
  id: "deploy-2",
  status: "failed",
  result: {
    routeSwitch: { status: "switched" },
    siteProbe: {
      finalUrl: "https://example.com/",
      dns: { status: "resolved" },
      tls: { status: "valid" },
      http: { status: "passed", statusCode: 200 },
    },
  },
});
assert.equal(
  workloadError.deploymentFailure.failureCode,
  "PRODUCTION_DEPLOYMENT_FAILED",
);
assert.equal(workloadError.deploymentFailure.externalSignoffRequired, false);
assert.equal(parityDeploymentErrorEvidence(new Error("plain")), null);

const chainEvidence = { status: "running", steps: {} };
await assert.rejects(
  checkedStep(chainEvidence, "production-execute", async () => {
    throw productionDeploymentFailure(row);
  }),
  /SITE_DNS_PROBE_UNAVAILABLE/,
);
assert.equal(
  chainEvidence.steps["production-execute"].errorDetail.failureCode,
  "SITE_DNS_PROBE_UNAVAILABLE",
);
assert.equal(JSON.stringify(chainEvidence).includes(secret), false);

process.stdout.write("deployment failure evidence self-test passed\n");

function fixture() {
  const error = {
    code: "SITE_PROBE_ADDRESS_FORBIDDEN",
    message: "address unavailable",
  };
  return {
    id: "deploy-1",
    status: "failed",
    environmentId: "production-1",
    artifactManifestId: "manifest-1",
    releaseRunId: "release-1",
    error: null,
    params: { secret },
    result: {
      secret,
      routeSwitch: {
        status: "switched",
        reasonCode: "site_route_switched",
        providerKey: "http-route-control-v1",
        operationId: "operation-1",
        deploymentRunId: "deploy-1",
        releaseRunId: "release-1",
        siteId: "site-1",
        routeHash: "b".repeat(64),
        targetRef: "filesystem-release-target",
        secret,
        receipt: {
          status: "switched",
          reasonCode: "site_route_switched",
          providerKey: "http-route-control-v1",
          operationId: "operation-1",
          secret,
          observed: { deploymentRunId: "deploy-1", routeHash: "b".repeat(64) },
        },
      },
      siteProbe: {
        finalUrl: "https://parity.example.test/",
        primaryDomain: "parity.example.test",
        secret,
        dns: { status: "unavailable", hostname: null, error },
        tls: {
          status: "unavailable",
          host: "parity.example.test",
          port: 443,
          error,
        },
        http: {
          status: "unavailable",
          url: "https://parity.example.test/",
          finalUrl: "https://parity.example.test/",
          error,
        },
      },
      gateDecision: {
        id: "gate-1",
        stage: "production",
        inputHash: "a".repeat(64),
        secret,
      },
    },
  };
}
