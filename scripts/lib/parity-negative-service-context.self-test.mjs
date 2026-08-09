#!/usr/bin/env node
import assert from "node:assert/strict";
import { requireActiveEnvironmentService } from "./parity-negative-service-context.mjs";

const calls = [];
const prisma = {
  applicationService: {
    findFirst: async (input) => {
      calls.push(input);
      return { id: "service-web-production" };
    },
  },
};
const contract = {
  component: "web",
  applicationId: "application-web",
  staging: { id: "service-web-staging" },
  production: { id: "service-web-production" },
};
assert.equal(
  await requireActiveEnvironmentService(prisma, {
    projectId: "project",
    environmentId: "production",
    contract,
  }),
  "service-web-production",
);
assert.deepEqual(calls[0].where, {
  id: "service-web-production",
  projectId: "project",
  environmentId: "production",
  applicationId: "application-web",
  status: "active",
});

prisma.applicationService.findFirst = async () => ({ id: "other-service" });
await assert.rejects(
  requireActiveEnvironmentService(prisma, {
    projectId: "project",
    environmentId: "production",
    contract,
  }),
  /service missing: web/,
);

await assert.rejects(
  requireActiveEnvironmentService(prisma, {
    projectId: "project",
    environmentId: "production",
    contract: { component: "web" },
  }),
  /contract missing/,
);

process.stdout.write("negative dynamic service context self-test passed\n");
