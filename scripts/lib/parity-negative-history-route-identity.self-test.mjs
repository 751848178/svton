#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildProductionRouteExpectation } from "./parity-production-route-evidence.mjs";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";
import { rejectIdentity } from "./parity-negative-history-identity-test-support.mjs";
import { validateProductionRouteIdentity } from "./parity-negative-history-route-identity.mjs";

const document = historyDocumentFixture();
const context = document.context;
const upgrade = document.steps["production-upgrade-execute"].result;
const recovery = document.steps["production-recovery-execute"].result;
const roots = {
  teamId: context.teamId,
  projectId: context.projectId,
  productionEnvId: context.productionEnvId,
  productionConfigRevisionId: context.productionConfigRevisionId,
  productionTargetRef: context.productionTargetRef,
  productionRouteSnapshot: context.productionRouteSnapshot,
};
validateProductionRouteIdentity(upgrade, roots, claimOf(upgrade));
validateProductionRouteIdentity(recovery, roots, claimOf(recovery));
for (const [label, root, mutate] of [
  ["team", true, (r) => (r.teamId = "claimed-team")],
  ["project", true, (r) => (r.projectId = "claimed-project")],
  ["environment", true, (r) => (r.productionEnvId = "claimed-env")],
  ["config", true, (r) => (r.productionConfigRevisionId = "claimed-config")],
  ["target", true, (r) => (r.productionTargetRef = "claimed-target")],
  [
    "deployment",
    false,
    (value, expected) => (value.deploymentRunId = "claimed-deploy"),
  ],
  [
    "release",
    false,
    (value, expected) => (expected.releaseRunId = "claimed-release"),
  ],
  [
    "manifest",
    false,
    (value, expected) => (expected.manifestId = "claimed-manifest"),
  ],
]) {
  const r = { ...roots };
  const e = claimOf(upgrade);
  mutate(root ? r : upgrade, e);
  assert.throws(
    () => validateProductionRouteIdentity(upgrade, r, e),
    undefined,
    label,
  );
}
rejectIdentity(
  "coherent alternate route proof with trusted snapshot restored",
  (value) => {
    const result = value.steps["production-upgrade-execute"].result;
    const claimed = result.routeEvidence.expected;
    const alternate = buildProductionRouteExpectation({
      teamId: claimed.teamId,
      projectId: claimed.projectId,
      environmentId: claimed.environmentId,
      deploymentRunId: claimed.deploymentRunId,
      releaseRunId: claimed.releaseRunId,
      manifestId: claimed.manifestId,
      configRevisionId: claimed.configRevisionId,
      routeSnapshot: {
        domains: ["alternate.example.test", "extra.example.test"],
        proxyTarget: "http://alternate-workload",
        tlsRequired: false,
      },
      siteId: claimed.siteId,
      targetRef: claimed.targetRef,
      providerKey: claimed.providerKey,
      receiptVersion: 1,
    });
    alternate.routeSnapshot = value.context.productionRouteSnapshot;
    replaceRouteProof(result, alternate);
  },
  ["production-upgrade-execute"],
);
for (const [label, substitute] of [
  ["primaryDomain", (e) => (e.primaryDomain = "claimed.example.test")],
  [
    "sorted domains",
    (e) => (e.domains = ["claimed.example.test", "z.example.test"]),
  ],
  ["proxyTarget", (e) => (e.proxyTarget = "http://claimed-target")],
  ["tlsRequired", (e) => (e.tlsRequired = false)],
  ["configuredFinalUrl", (e) => (e.configuredFinalUrl = "http://claimed/")],
  ["routeHash", (e) => (e.routeHash = "f".repeat(64))],
  ["operationId", (e) => (e.operationId = "site-route:claimed")],
]) {
  rejectIdentity(
    `coherent route substitution: ${label}`,
    (value) => {
      const result = value.steps["production-upgrade-execute"].result;
      substitute(result.routeEvidence.expected);
      replaceRouteProof(result, result.routeEvidence.expected);
    },
    ["production-upgrade-execute"],
  );
}
process.stdout.write("negative history route identity self-test passed\n");
function claimOf(result) {
  return {
    kind: result.newEnvironmentVersion.kind,
    manifestId: result.manifestId,
    releaseRunId: result.releaseRunId,
  };
}
function replaceRouteProof(result, expected) {
  const proof = result.routeEvidence;
  proof.expected = { ...expected };
  syncSwitch(proof.deploymentRouteSwitch, expected);
  syncSwitch(proof.siteCurrent.routeSwitch, expected);
  syncSwitch(proof.routeRuns[0].result.routeSwitch, expected);
  syncProbe(proof.siteProbe, expected);
  syncProbe(proof.routeRuns[0].result.siteProbe, expected);
  proof.siteCurrent.primaryDomain = expected.primaryDomain;
  proof.routeRuns[0].domains = [...expected.domains];
  proof.routeRuns[0].proxyTarget = expected.proxyTarget;
  proof.releaseRun.routeSnapshot = { ...expected.routeSnapshot };
  result.siteProbe = proof.siteProbe;
  result.routeSwitch = proof.deploymentRouteSwitch;
  result.gateDecision = result.productionGate.resultGate;
}
function syncSwitch(value, e) {
  value.operationId = e.operationId;
  value.primaryDomain = e.primaryDomain;
  value.domains = [...e.domains];
  value.proxyTarget = e.proxyTarget;
  value.routeHash = e.routeHash;
  value.receipt.operationId = e.operationId;
  value.receipt.observed.siteId = e.siteId;
  value.receipt.observed.deploymentRunId = e.deploymentRunId;
  value.receipt.observed.targetRef = e.targetRef;
  value.receipt.observed.routeHash = e.routeHash;
}
function syncProbe(value, e) {
  value.primaryDomain = e.primaryDomain;
  value.finalUrl = e.configuredFinalUrl;
  value.http.url = e.configuredFinalUrl;
  value.http.finalUrl = e.configuredFinalUrl;
  value.tls.host = e.primaryDomain;
  value.tls.servername = e.primaryDomain;
}
