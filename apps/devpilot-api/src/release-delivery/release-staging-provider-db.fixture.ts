import type { PrismaClient } from "@prisma/client";
import { createTestCryptoService } from "../common/crypto/crypto.test-helpers";
import { managedCommandWorkloadConfig } from "./release-workload.integration-fixtures";

export async function seedReleaseStagingProviderScope(
  prisma: PrismaClient,
  input: { suffix: string; userId: string; teamId: string; projectId: string },
) {
  await prisma.user.create({
    data: {
      id: input.userId,
      email: `${input.suffix}@staging.example`,
      role: "user",
    },
  });
  await prisma.team.create({
    data: { id: input.teamId, name: "Staging Team" },
  });
  await prisma.project.create({
    data: {
      id: input.projectId,
      teamId: input.teamId,
      createdById: input.userId,
      name: "Staging Project",
      config: {},
    },
  });
  const staging = await prisma.projectEnvironment.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      key: "staging",
      name: "Staging",
      baselineRole: "staging",
    },
  });
  const application = await prisma.application.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      createdById: input.userId,
      name: "Staging application",
    },
  });
  const service = await prisma.applicationService.create({
    data: {
      id: `staging-service-${input.suffix}`,
      teamId: input.teamId,
      projectId: input.projectId,
      applicationId: application.id,
      environmentId: staging.id,
      name: "api",
      kind: "static",
      deployConfig: managedCommandWorkloadConfig(),
    },
  });
  const crypto = createTestCryptoService();
  const secret = await prisma.secretKey.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: staging.id,
      createdById: input.userId,
      name: "deploy-secret",
      type: "api_key",
      value: crypto.encryptCbc("secret-sentinel-f432"),
    },
  });
  const resourceType = await prisma.resourceType.create({
    data: {
      key: `f432-mysql-${input.suffix}`,
      name: "F432 MySQL",
      createdById: input.userId,
      envTemplate: "DATABASE_HOST=${host}\nDATABASE_PASSWORD=${password}",
    },
  });
  const resource = await prisma.resourceInstance.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: staging.id,
      resourceTypeId: resourceType.id,
      name: "F432 database",
      status: "active",
      delivery: { host: "mysql.staging.internal" },
      credentials: crypto.encryptGcm(
        JSON.stringify({ password: "resource-sentinel-f432" }),
      ),
    },
  });
  const revision = await prisma.environmentConfigRevision.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: staging.id,
      createdById: input.userId,
      revision: 1,
      snapshotHash: "f432-staging-config",
      plainVariables: { PLAIN_F432: "plain-sentinel-f432" },
      secretReferences: [
        { id: secret.id, name: secret.name, type: secret.type },
      ],
      resourceReferences: [
        {
          id: resource.id,
          kind: "resource_instance",
          name: resource.name,
          sharedEnvironmentIds: [staging.id],
          risk: "medium",
          impact: "staging runtime database",
        },
      ],
      routeSnapshot: {},
      policyReferences: [],
    },
  });
  const server = await prisma.server.create({
    data: {
      teamId: input.teamId,
      createdById: input.userId,
      name: "Filesystem provider target",
      host: "local-provider",
      username: "devpilot",
      authType: "password",
      credentials: "not-used-by-local-provider",
      status: "online",
    },
  });
  const binding = await prisma.projectEnvironmentServer.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: staging.id,
      serverId: server.id,
      role: "deployment",
      metadata: {
        releaseDeployment: {
          providerKey: "local-filesystem-v1",
          targetRef: "filesystem-release-target",
        },
      },
    },
  });
  await prisma.projectEnvironment.update({
    where: { id: staging.id },
    data: { currentConfigRevisionId: revision.id },
  });
  const order = await prisma.releaseOrder.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      createdById: input.userId,
      releaseVersion: "1.0.0",
    },
  });
  const build = await prisma.buildRun.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      releaseOrderId: order.id,
      triggeredById: input.userId,
      revision: 1,
      sourceBranch: "main",
      sourceCommitSha: "a".repeat(40),
      inputSnapshot: {},
      inputHash: "hash",
      status: "succeeded",
    },
  });
  return {
    stagingId: staging.id,
    orderId: order.id,
    build,
    revisionId: revision.id,
    resourceId: resource.id,
    resourceTypeId: resourceType.id,
    serverId: server.id,
    bindingId: binding.id,
    serviceId: service.id,
  };
}
