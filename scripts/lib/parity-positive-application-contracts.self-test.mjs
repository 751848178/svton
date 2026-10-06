import assert from "node:assert/strict";
import { bindPositiveApplicationContracts } from "./parity-positive-application-contracts.mjs";

const updates = [];
const upserts = [];
const applications = [
  application("web-app", "@parity/web", "apps/web", "web-production"),
  application("api-app", "@parity/api", "apps/api", "api-production"),
];
const prisma = {
  application: { findMany: async () => applications },
  applicationService: {
    update: async (input) => {
      updates.push(input);
      const name = input.where.id.startsWith("web") ? "@parity/web" : "@parity/api";
      return { id: input.where.id, name, ports: input.data.ports };
    },
    upsert: async (input) => {
      upserts.push(input);
      return {
        id: `${input.create.applicationId}-staging`,
        name: input.create.name,
        ports: input.create.ports,
      };
    },
  },
};
const result = await bindPositiveApplicationContracts(prisma, {
  teamId: "team-1",
  projectId: "project-1",
  stagingEnvId: "staging-1",
  productionEnvId: "production-1",
});

assert.deepEqual(updates.map((input) => input.where.id).sort(), [
  "api-production",
  "web-production",
]);
assert.deepEqual(upserts.map((input) => input.create.name).sort(), [
  "@parity/api",
  "@parity/web",
]);
assert.ok(upserts.every((input) => input.create.environmentId === "staging-1"));
assert.deepEqual(
  result.map((entry) => entry.staging.ports[0]),
  [80, 4300],
);
assert.deepEqual(result.map((entry) => entry.production.id).sort(), [
  "api-production",
  "web-production",
]);
assert.deepEqual(
  result.map((entry) => entry.component),
  ["web", "api"],
);
for (const applicationId of ["api-app"]) {
  const staging = upserts.find(
    (input) => input.create.applicationId === applicationId,
  )?.create.deployConfig;
  const productionId = `${applicationId.split("-")[0]}-production`;
  const production = updates.find((input) => input.where.id === productionId)
    ?.data.deployConfig;
  assert.deepEqual(staging, production);
}
const webContract = updates.find(
  (input) => input.where.id === "web-production",
)?.data.deployConfig;
const stagingWebContract = upserts.find(
  (input) => input.create.applicationId === "web-app",
)?.create.deployConfig;
const apiContract = updates.find(
  (input) => input.where.id === "api-production",
)?.data.deployConfig;
assert.equal(
  webContract.healthCheckUrl,
  "http://127.0.0.1:4311/health",
);
assert.equal(stagingWebContract.healthCheckUrl, "http://127.0.0.1:4310/health");
assert.equal(webContract.deployCommand, "node dist/server.mjs 4311");
assert.equal(stagingWebContract.deployCommand, "node dist/server.mjs 4310");
assert.equal(webContract.workloadExecutionMode, "managed-process-v1");
assert.equal(webContract.healthCheckAttempts, 3);
assert.equal(apiContract.healthCheckUrl, undefined);
console.log("positive application contract identity self-test passed");

function application(id, name, repoPath, serviceId) {
  return {
    id,
    name,
    repoPath,
    services: [{ id: serviceId, name, environmentId: "production-1" }],
  };
}
