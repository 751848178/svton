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
      return { id: input.where.id };
    },
    upsert: async (input) => {
      upserts.push(input);
      return { id: `${input.create.applicationId}-staging` };
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
assert.deepEqual(result.map((entry) => entry.production.id).sort(), [
  "api-production",
  "web-production",
]);
assert.deepEqual(
  result.map((entry) => entry.component),
  ["web", "api"],
);
console.log("positive application contract identity self-test passed");

function application(id, name, repoPath, serviceId) {
  return {
    id,
    name,
    repoPath,
    services: [{ id: serviceId, name, environmentId: "production-1" }],
  };
}
