import { EnvironmentConfigRevisionService } from "./environment-config-revision.service";

/**
 * F447 AC-SET-040: redaction/leak regression — the revision API surface and the
 * same-transaction audit metadata must NEVER carry secret VALUES; only secret
 * references (id/name/type) and the compat config.envVars mirror (plain vars
 * only) are allowed to leave the write path.
 */

function txClient() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "env-1" }]),
    projectEnvironment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn().mockImplementation(({ where, data }) => ({
        id: where.id,
        teamId: "team-1",
        projectId: "project-1",
        key: "staging",
        name: "Staging",
        description: null,
        status: "active",
        sortOrder: 10,
        baselineRole: "staging",
        identityLockedAt: null,
        currentConfigRevisionId: data.currentConfigRevisionId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
    environmentConfigRevision: {
      findFirst: jest.fn().mockResolvedValue({ revision: 0 }),
      create: jest.fn().mockImplementation(({ data }) => ({
        ...data,
        id: "rev-1",
        createdAt: new Date(),
        createdBy: null,
      })),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
}

function prismaMock(tx: ReturnType<typeof txClient>) {
  return {
    $transaction: jest.fn(async (fn: (client: any) => unknown) => fn(tx)),
    projectEnvironment: tx.projectEnvironment,
  } as never;
}

function environmentWith(extra: Record<string, unknown> = {}) {
  return {
    id: "env-1",
    teamId: "team-1",
    projectId: "project-1",
    key: "staging",
    name: "Staging",
    description: null,
    baselineRole: "staging",
    config: { envVars: { NODE_ENV: "staging" } },
    currentConfigRevisionId: null,
    currentConfigRevision: null,
    ...extra,
  };
}

const SECRET_VALUE = "s3cr3t-plaintext-value-12345";
const RESOLVED = {
  plainVariables: { NODE_ENV: "staging", PUBLIC_SITE_URL: "https://staging.example.com" },
  secretReferences: [{ id: "secret-1", name: "s3_access_key", type: "aws" }],
  resourceReferences: [],
  routeSnapshot: { domains: ["staging.example.com"] },
  policyReferences: [],
};

describe("EnvironmentConfigRevision redaction (F447 AC-SET-040)", () => {
  it("never writes or returns the secret value on the revision row", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue(environmentWith());
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      { resolve: jest.fn().mockResolvedValue(RESOLVED) } as never,
    );

    const result = await service.create("team-1", "user-1", "env-1", {
      plainVariables: { NODE_ENV: "staging" },
      secretReferenceIds: ["secret-1"],
    });

    const createData = tx.environmentConfigRevision.create.mock.calls[0][0].data;
    expect(JSON.stringify(createData)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(createData)).not.toContain("s3cr3t");
    expect(createData.secretReferences).toEqual([{
      id: "secret-1", name: "s3_access_key", type: "aws",
    }]);
    // The returned revision exposes refs only, never values.
    expect(JSON.stringify(result.revision)).not.toContain(SECRET_VALUE);
    expect(result.revision.secretReferences).toEqual([{
      id: "secret-1", name: "s3_access_key", type: "aws",
    }]);
  });

  it("keeps the audit metadata key-only: no secret values, no plain values either", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue(environmentWith());
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      { resolve: jest.fn().mockResolvedValue(RESOLVED) } as never,
    );

    await service.create("team-1", "user-1", "env-1", {
      plainVariables: { NODE_ENV: "staging", PUBLIC_SITE_URL: "https://staging.example.com" },
      secretReferenceIds: ["secret-1"],
    });

    const auditData = tx.auditEvent.create.mock.calls[0][0].data;
    expect(auditData.summary).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(auditData.metadata)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(auditData.metadata)).not.toContain("s3cr3t");
    expect(JSON.stringify(auditData.metadata)).not.toContain("https://staging.example.com");
    expect(auditData.metadata.plainVariableKeys).toEqual(["NODE_ENV", "PUBLIC_SITE_URL"]);
    expect(auditData.metadata.secretReferenceIds).toEqual(["secret-1"]);
  });

  it("mirrors only plain vars into the compat config.envVars, never secret values", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue(environmentWith());
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      {
        resolve: jest.fn().mockResolvedValue({
          ...RESOLVED,
          plainVariables: { NODE_ENV: "staging" },
        }),
      } as never,
    );

    await service.create("team-1", "user-1", "env-1", {
      plainVariables: { NODE_ENV: "staging" },
      secretReferenceIds: ["secret-1"],
    });

    const envUpdate = tx.projectEnvironment.update.mock.calls[0][0];
    const mirrored = (envUpdate.data.config as Record<string, unknown>).envVars;
    expect(mirrored).toEqual({ NODE_ENV: "staging" });
    expect(JSON.stringify(envUpdate.data)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(envUpdate.data)).not.toContain("s3cr3t");
  });

  it("leaks nothing when a copy targets multiple environments (per-env revisions + audits)", async () => {
    const tx = txClient();
    tx.projectEnvironment.findFirst.mockResolvedValue({
      id: "env-source", projectId: "project-1",
    });
    tx.projectEnvironment.findMany.mockResolvedValue([
      { id: "env-staging", key: "staging", currentConfigRevisionId: null },
      { id: "env-preview", key: "preview", currentConfigRevisionId: null },
    ]);
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue(environmentWith());
    tx.environmentConfigRevision.findFirst.mockResolvedValue({ revision: 1 });
    tx.environmentConfigRevision.create.mockImplementation(({ data }) => ({
      ...data, id: `rev-${data.revision}`, createdAt: new Date(), createdBy: null,
    }));
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      { resolve: jest.fn().mockResolvedValue(RESOLVED) } as never,
    );

    const result = await service.copyToEnvironments("team-1", "user-1", "env-source", {
      targets: [{ environmentId: "env-staging" }, { environmentId: "env-preview" }],
      plainVariables: { NODE_ENV: "staging" },
      secretReferenceIds: ["secret-1"],
      changeSummary: "复用密钥引用",
    });

    const allCalls = [
      ...tx.environmentConfigRevision.create.mock.calls.flatMap((call) => [call[0].data]),
      ...tx.auditEvent.create.mock.calls.flatMap((call) => [call[0].data]),
    ];
    expect(JSON.stringify(allCalls)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(allCalls)).not.toContain("s3cr3t");
    expect(JSON.stringify(result)).not.toContain(SECRET_VALUE);
    expect(result.results.every((item) => item.ok)).toBe(true);
  });
});
