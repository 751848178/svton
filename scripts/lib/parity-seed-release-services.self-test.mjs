import assert from "node:assert/strict";
import { seedParityReleaseServiceRequirements } from "./parity-seed-release-services.mjs";

const ids = {
  svcWeb: "staging-web", svcApi: "staging-api",
  svcWebProduction: "production-web", svcApiProduction: "production-api",
};
const configs = new Map(Object.values(ids).map((id) => [id, {
  workloadExecutionMode: "managed-command-v1",
  deployCommand: "test -f dist/index.html",
  statusCommand: "test -f dist/index.html",
  failureCleanupCommand: "true",
}]));
const prisma = { applicationService: {
  findUnique: async ({ where }) => ({ deployConfig: configs.get(where.id) }),
  update: async ({ where, data }) => configs.set(where.id, data.deployConfig),
} };

await seedParityReleaseServiceRequirements({ prisma, ids });
const productionApi = configs.get(ids.svcApiProduction);
assert.equal(productionApi.workloadExecutionMode, "managed-process-v1");
assert.equal(productionApi.deployCommand, "node dist-production/server.js");
assert.equal(productionApi.healthCheckUrl, "http://127.0.0.1:4301/health");
assert.equal(productionApi.statusCommand, undefined);
assert.equal(configs.get(ids.svcWebProduction).healthCheckUrl, undefined);
process.stdout.write("parity release service baseline self-test passed\n");
