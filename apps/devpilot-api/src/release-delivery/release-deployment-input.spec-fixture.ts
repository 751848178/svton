import { createTestCryptoService } from "../common/crypto/crypto.test-helpers";
import type { PrismaService } from "../prisma/prisma.service";
import { ReleaseDeploymentInputService } from "./release-deployment-input.service";

const changedAt = new Date("2026-08-05T00:00:00.000Z");

export function deploymentInputFixture() {
  const crypto = createTestCryptoService();
  const state = {
    plainVariables: { NODE_ENV: "plain-sentinel-f432" },
    resourceReferences: [resourceReference()],
    secretReferences: [{ id: "secret-1", name: "api-token", type: "api_key" }],
    revisionTeamId: "team-1",
    bindingTeamId: "team-1",
    serverTeamId: "team-1",
    serverHost: "target.example",
    includeBinding: true,
    duplicateBinding: false,
  };
  const secret = {
    id: "secret-1",
    name: "api-token",
    type: "api_key",
    value: crypto.encryptCbc("secret-sentinel-f432"),
    updatedAt: changedAt,
  };
  const resource = {
    id: "resource-1",
    name: "database",
    status: "active",
    environmentId: "staging-1",
    updatedAt: changedAt,
    delivery: { host: "db.example", port: 3306, database: "app" },
    credentials: crypto.encryptGcm(
      JSON.stringify({ username: "app", password: "resource-sentinel-f432" }),
    ),
    resourceType: {
      envTemplate:
        "DATABASE_URL=mysql://${username}:${password}@${host}:${port}/${database}",
    },
  };
  const database = databaseDouble(state, secret, resource, crypto);
  return {
    state,
    crypto,
    secret,
    resource,
    database,
    service: new ReleaseDeploymentInputService(
      database as unknown as PrismaService,
      crypto,
    ),
  };
}

export const prepareDeploymentInput = {
  teamId: "team-1",
  projectId: "project-1",
  environmentId: "staging-1",
  providerKey: "ssh-v1",
};

function databaseDouble(
  state: {
    plainVariables: Record<string, string>;
    secretReferences: Array<Record<string, string>>;
    resourceReferences: Array<Record<string, unknown>>;
    revisionTeamId: string;
    bindingTeamId: string;
    serverTeamId: string;
    serverHost: string;
    includeBinding: boolean;
    duplicateBinding: boolean;
  },
  secret: Record<string, unknown>,
  resource: Record<string, unknown>,
  crypto: ReturnType<typeof createTestCryptoService>,
) {
  return {
    projectEnvironment: {
      findMany: jest.fn(async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in
          .filter((id) => id === "staging-1")
          .map((id) => ({ id })),
      ),
      findFirst: jest.fn(async () => ({
        id: "staging-1",
        currentConfigRevision: {
          id: "config-1",
          teamId: state.revisionTeamId,
          projectId: "project-1",
          environmentId: "staging-1",
          revision: 7,
          snapshotHash: "snapshot-hash-7",
          plainVariables: state.plainVariables,
          secretReferences: state.secretReferences,
          resourceReferences: state.resourceReferences,
        },
        serverBindings: state.includeBinding
          ? [
              {
                id: "binding-1",
                teamId: state.bindingTeamId,
                projectId: "project-1",
                environmentId: "staging-1",
                metadata: {
                  releaseDeployment: {
                    providerKey: "ssh-v1",
                    root: "/srv/app",
                  },
                },
                updatedAt: changedAt,
                server: {
                  id: "server-1",
                  teamId: state.serverTeamId,
                  host: state.serverHost,
                  port: 2222,
                  username: "deploy",
                  authType: "password",
                  credentials: crypto.encryptGcm("ssh-sentinel-f432"),
                  updatedAt: changedAt,
                },
              },
              ...(state.duplicateBinding
                ? [
                    {
                      id: "binding-2",
                      teamId: state.bindingTeamId,
                      projectId: "project-1",
                      environmentId: "staging-1",
                      metadata: {
                        releaseDeployment: {
                          providerKey: "ssh-v1",
                          root: "/srv/duplicate",
                        },
                      },
                      updatedAt: changedAt,
                      server: {
                        id: "server-2",
                        teamId: state.serverTeamId,
                        host: state.serverHost,
                        port: 2222,
                        username: "deploy",
                        authType: "password",
                        credentials: crypto.encryptGcm("ssh-sentinel-f432"),
                        updatedAt: changedAt,
                      },
                    },
                  ]
                : []),
            ]
          : [],
      })),
    },
    secretKey: { findMany: jest.fn(async () => [secret]) },
    resourceInstance: { findFirst: jest.fn(async () => resource) },
    managedResource: { findFirst: jest.fn(async () => null) },
    site: { findFirst: jest.fn(async () => null) },
    cDNConfig: { findFirst: jest.fn(async () => null) },
  };
}

function resourceReference() {
  return {
    id: "resource-1",
    kind: "resource_instance",
    name: "database",
    sharedEnvironmentIds: ["staging-1"],
    risk: "medium",
    impact: "runtime database",
  };
}
