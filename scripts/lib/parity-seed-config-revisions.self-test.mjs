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
  assert.equal(data.routeSnapshot.proxyTarget, runtime.targetOrigin);
}

process.stdout.write("parity seed config revision self-test passed\n");
