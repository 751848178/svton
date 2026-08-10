import type { PrismaClient } from "@prisma/client";
import type { CryptoService } from "../common/crypto/crypto.service";

export async function seedReleaseStagingHttpInput(
  prisma: PrismaClient,
  crypto: CryptoService,
  input: {
    suffix: string;
    teamId: string;
    projectId: string;
    userId: string;
    environmentId: string;
  },
) {
  const secret = await prisma.secretKey.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      createdById: input.userId,
      name: "http-deploy-secret",
      type: "api_key",
      value: crypto.encryptCbc("http-secret-sentinel-f432"),
    },
  });
  const resourceType = await prisma.resourceType.create({
    data: {
      key: `f432-http-${input.suffix}`,
      name: "F432 HTTP database",
      envTemplate: "DATABASE_HOST=${host}\nDATABASE_PASSWORD=${password}",
    },
  });
  const resource = await prisma.resourceInstance.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      resourceTypeId: resourceType.id,
      name: "F432 HTTP database",
      status: "active",
      delivery: { host: "http-mysql.staging.internal" },
      credentials: crypto.encryptGcm(
        JSON.stringify({ password: "http-resource-sentinel-f432" }),
      ),
    },
  });
  const target = boundSshTarget();
  const server = await prisma.server.create({
    data: {
      teamId: input.teamId,
      createdById: input.userId,
      name: "F432 HTTP SSH target",
      host: target.host,
      port: target.port,
      username: target.username,
      authType: "password",
      credentials: crypto.encryptGcm(target.password),
      status: "online",
    },
  });
  const revision = await prisma.environmentConfigRevision.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      createdById: input.userId,
      revision: 1,
      snapshotHash: "f432-http-config",
      plainVariables: { HTTP_PLAIN_F432: "http-plain-sentinel-f432" },
      secretReferences: [
        { id: secret.id, name: secret.name, type: secret.type },
      ],
      resourceReferences: [
        {
          id: resource.id,
          kind: "resource_instance",
          name: resource.name,
          sharedEnvironmentIds: [input.environmentId],
          risk: "medium",
          impact: "authenticated HTTP staging runtime database",
        },
      ],
      routeSnapshot: {},
      policyReferences: [],
    },
  });
  await prisma.projectEnvironmentServer.create({
    data: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      serverId: server.id,
      role: "deployment",
      metadata: {
        releaseDeployment: {
          providerKey: "ssh-v1",
          root: requireRemoteRoot(),
        },
      },
    },
  });
  await prisma.projectEnvironment.update({
    where: { id: input.environmentId },
    data: { currentConfigRevisionId: revision.id },
  });
  return resourceType.id;
}

function boundSshTarget() {
  return {
    host:
      process.env.F432_BOUND_SSH_HOST ||
      process.env.RELEASE_DEPLOYMENT_SSH_HOST ||
      "127.0.0.1",
    port: Number(
      process.env.F432_BOUND_SSH_PORT ||
        process.env.RELEASE_DEPLOYMENT_SSH_PORT ||
        2225,
    ),
    username:
      process.env.F432_BOUND_SSH_USERNAME ||
      process.env.RELEASE_DEPLOYMENT_SSH_USERNAME ||
      "deploy",
    password:
      process.env.F432_BOUND_SSH_PASSWORD ||
      process.env.RELEASE_DEPLOYMENT_SSH_PASSWORD ||
      "devpilot-test",
  };
}

function requireRemoteRoot() {
  const root = process.env.RELEASE_DEPLOYMENT_SSH_ROOT;
  if (!root || !/^\/config\/[A-Za-z0-9_-]+$/.test(root)) {
    throw new Error("F432 SSH runtime root is missing or unsafe");
  }
  return root;
}
