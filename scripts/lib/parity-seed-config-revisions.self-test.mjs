import assert from "node:assert/strict";
import { parityConfigRevisionData } from "./parity-seed-config-revisions.mjs";

const ids = {
  team: "team",
  project: "project",
  user: "user",
  envStaging: "staging",
  envProduction: "production",
  configStaging: "config-staging",
  configProduction: "config-production",
  secret: "secret",
  resourceInstance: "resource",
  managedResource: "managed-resource",
};
const runtime = { targetOrigin: "http://127.0.0.1:43210" };

for (const role of ["staging", "production"]) {
  const data = parityConfigRevisionData(ids, runtime, role);
  const environmentId = role === "staging" ? "staging" : "production";
  assert.deepEqual(data.secretReferences, [
    { id: "secret", name: "parity-api-key", type: "api_key" },
  ]);
  assert.deepEqual(data.resourceReferences[0].sharedEnvironmentIds, [
    environmentId,
  ]);
  assert.equal(data.resourceReferences[0].kind, "resource_instance");
  assert.deepEqual(data.policyReferences, []);
  assert.equal(data.routeSnapshot.proxyTarget, runtime.targetOrigin);
  assert.match(data.snapshotHash, /^[a-f0-9]{64}$/);
}

const staging = parityConfigRevisionData(ids, runtime, "staging");
const production = parityConfigRevisionData(ids, runtime, "production");
assert.equal(staging.resourceReferences.length, 1);
assert.deepEqual(production.resourceReferences[1], {
  id: "managed-resource",
  kind: "managed_resource",
  sharedEnvironmentIds: ["production"],
  risk: "medium",
  impact: "production connectivity, capacity and restore-point evidence",
});
assert.notEqual(staging.snapshotHash, production.snapshotHash);
assert.notEqual(
  production.snapshotHash,
  parityConfigRevisionData(
    ids,
    { targetOrigin: "http://127.0.0.1:43211" },
    "production",
  ).snapshotHash,
);

process.stdout.write("parity seed config revision self-test passed\n");
