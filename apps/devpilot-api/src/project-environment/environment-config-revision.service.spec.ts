import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { EnvironmentConfigRevisionService } from "./environment-config-revision.service";

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
        name: data.name ?? "Staging",
        description: data.description ?? null,
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
      findFirst: jest.fn().mockResolvedValue({ revision: 3 }),
      create: jest.fn().mockImplementation(({ data }) => ({
        ...data,
        id: "rev-4",
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

function revisionService(tx: ReturnType<typeof txClient>) {
  return new EnvironmentConfigRevisionService(
    prismaMock(tx),
    {} as never,
  );
}

describe("EnvironmentConfigRevisionService.updateIdentity (AC-SET-014/015)", () => {
  it("appends an immutable revision carrying the identity and audits in the same tx", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue({
      id: "env-1",
      teamId: "team-1",
      projectId: "project-1",
      key: "staging",
      name: "Staging",
      description: null,
      currentConfigRevisionId: "rev-3",
      currentConfigRevision: {
        snapshotHash: "sha256:abc",
        plainVariables: { A: "1" },
        secretReferences: [],
        resourceReferences: [],
        routeSnapshot: { domains: ["staging.example.com"] },
        policyReferences: [],
      },
    });
    const service = revisionService(tx);
    const result = await service.updateIdentity("team-1", "user-1", "env-1", {
      name: "预发",
      description: "预发验证环境",
      reason: "演示对齐改名",
    });

    const createData = tx.environmentConfigRevision.create.mock.calls[0][0].data;
    expect(createData.revision).toBe(4);
    expect(createData.displayName).toBe("预发");
    expect(createData.displayDescription).toBe("预发验证环境");
    expect(createData.snapshotHash).toBe("sha256:abc");
    expect(createData.plainVariables).toEqual({ A: "1" });
    expect(createData.routeSnapshot).toEqual({ domains: ["staging.example.com"] });

    const envUpdate = tx.projectEnvironment.update.mock.calls[0][0];
    expect(envUpdate).toEqual(
      expect.objectContaining({
        where: { id: "env-1" },
        data: { name: "预发", description: "预发验证环境", currentConfigRevisionId: "rev-4" },
      }),
    );

    const auditData = tx.auditEvent.create.mock.calls[0][0].data;
    expect(auditData.action).toBe("project_environment.identity.update");
    expect(auditData.risk).toBe("medium");
    expect(auditData.summary).toContain("演示对齐改名");
    expect(auditData.metadata).toEqual(
      expect.objectContaining({
        previousName: "Staging",
        previousDescription: null,
        name: "预发",
        description: "预发验证环境",
        reason: "演示对齐改名",
      }),
    );
    expect(result.environment.name).toBe("预发");
    expect(result.revision.current).toBe(true);
  });

  it("keeps previous identity when only description is edited", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue({
      id: "env-1",
      teamId: "team-1",
      projectId: "project-1",
      key: "staging",
      name: "Staging",
      description: null,
      currentConfigRevisionId: "rev-3",
      currentConfigRevision: {
        snapshotHash: "sha256:abc",
        plainVariables: {},
        secretReferences: [],
        resourceReferences: [],
        routeSnapshot: {},
        policyReferences: [],
      },
    });
    const service = revisionService(tx);
    await service.updateIdentity("team-1", "user-1", "env-1", { description: "预发验证环境" });
    const createData = tx.environmentConfigRevision.create.mock.calls[0][0].data;
    expect(createData.displayName).toBe("Staging");
    expect(createData.displayDescription).toBe("预发验证环境");
  });

  it("rejects a stale identity edit with a ConflictException (CAS unchanged)", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue({
      id: "env-1",
      teamId: "team-1",
      projectId: "project-1",
      key: "staging",
      name: "Staging",
      description: null,
      currentConfigRevisionId: "rev-3",
      currentConfigRevision: {
        snapshotHash: "sha256:abc",
        plainVariables: {},
        secretReferences: [],
        resourceReferences: [],
        routeSnapshot: {},
        policyReferences: [],
      },
    });
    const service = revisionService(tx);
    await expect(
      service.updateIdentity("team-1", "user-1", "env-1", {
        name: "预发",
        expectedCurrentRevisionId: "rev-2",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.environmentConfigRevision.create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException for a missing environment", async () => {
    const tx = txClient();
    tx.$queryRaw.mockResolvedValue([]);
    const service = revisionService(tx);
    await expect(
      service.updateIdentity("team-1", "user-1", "missing", { name: "x" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("EnvironmentConfigRevisionService.create (F446 AC-SET-026/030)", () => {
  const RESOLVED = {
    plainVariables: {},
    secretReferences: [],
    resourceReferences: [{
      kind: "managed_resource", id: "resource-1", name: "redis-prod",
      sharedEnvironmentIds: ["env-1"], risk: "high", impact: "prod",
    }],
    routeSnapshot: {},
    policyReferences: [],
  };

  function txClientWith() {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue({
      id: "env-1",
      teamId: "team-1",
      projectId: "project-1",
      key: "production",
      name: "Production",
      description: null,
      baselineRole: "production",
      config: null,
      currentConfigRevisionId: "rev-3",
      currentConfigRevision: null,
    });
    return { tx, service: null as never };
  }

  it("rejects a stale create with a ConflictException and appends nothing (revision CAS intact)", async () => {
    const { tx } = txClientWith();
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      { resolve: jest.fn() } as never,
    );
    await expect(
      service.create("team-1", "user-1", "env-1", {
        resourceReferences: [{
          kind: "managed_resource", id: "resource-1",
          sharedEnvironmentIds: ["env-1"], risk: "high", impact: "prod",
        }],
        expectedCurrentRevisionId: "rev-2",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.environmentConfigRevision.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("enforces the production anti-share rule at the revision write path", async () => {
    const { tx } = txClientWith();
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      {
        resolve: jest.fn().mockRejectedValue(
          new BadRequestException("Production 环境禁止与非生产环境共享资源"),
        ),
      } as never,
    );
    await expect(
      service.create("team-1", "user-1", "env-1", {
        resourceReferences: [{
          kind: "managed_resource", id: "resource-1",
          sharedEnvironmentIds: ["env-1", "env-2"], risk: "high", impact: "prod",
        }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.environmentConfigRevision.create).not.toHaveBeenCalled();
    expect(tx.projectEnvironment.update).not.toHaveBeenCalled();
  });

  it("passes the environment baselineRole into the resolver scope", async () => {
    const resolve = jest.fn().mockResolvedValue(RESOLVED);
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue({
      id: "env-1",
      teamId: "team-1",
      projectId: "project-1",
      key: "production",
      name: "Production",
      description: null,
      baselineRole: "production",
      config: null,
      currentConfigRevisionId: null,
      currentConfigRevision: null,
    });
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      { resolve } as never,
    );
    await service.create("team-1", "user-1", "env-1", {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1"], risk: "high", impact: "prod",
      }],
    });
    expect(resolve.mock.calls[0][1]).toMatchObject({ id: "env-1", baselineRole: "production" });
  });
});

describe("EnvironmentConfigRevisionService.create changeSummary (F447 AC-SET-039)", () => {
  const RESOLVED = {
    plainVariables: {},
    secretReferences: [],
    resourceReferences: [],
    routeSnapshot: {},
    policyReferences: [],
  };

  it("persists the change summary on the revision row and returns it in the select", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue({
      id: "env-1",
      teamId: "team-1",
      projectId: "project-1",
      key: "staging",
      name: "Staging",
      description: null,
      baselineRole: "staging",
      config: null,
      currentConfigRevisionId: "rev-3",
      currentConfigRevision: null,
    });
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      { resolve: jest.fn().mockResolvedValue(RESOLVED) } as never,
    );
    const result = await service.create("team-1", "user-1", "env-1", {
      changeSummary: "  导入 DATABASE_URL 与 API 域名  ",
    });

    const createData = tx.environmentConfigRevision.create.mock.calls[0][0].data;
    expect(createData.changeSummary).toBe("导入 DATABASE_URL 与 API 域名");
    expect(result.revision.changeSummary).toBe("导入 DATABASE_URL 与 API 域名");
  });

  it("persists null changeSummary when omitted", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue({
      id: "env-1",
      teamId: "team-1",
      projectId: "project-1",
      key: "staging",
      name: "Staging",
      description: null,
      baselineRole: "staging",
      config: null,
      currentConfigRevisionId: null,
      currentConfigRevision: null,
    });
    const service = new EnvironmentConfigRevisionService(
      prismaMock(tx),
      { resolve: jest.fn().mockResolvedValue(RESOLVED) } as never,
    );
    await service.create("team-1", "user-1", "env-1", {});
    expect(tx.environmentConfigRevision.create.mock.calls[0][0].data.changeSummary).toBeNull();
  });
});

describe("EnvironmentConfigRevisionService.updateIdentity changeSummary (F447 AC-SET-039)", () => {
  it("persists the reason as the change summary on the identity revision", async () => {
    const tx = txClient();
    tx.projectEnvironment.findUniqueOrThrow.mockResolvedValue({
      id: "env-1",
      teamId: "team-1",
      projectId: "project-1",
      key: "staging",
      name: "Staging",
      description: null,
      currentConfigRevisionId: "rev-3",
      currentConfigRevision: {
        snapshotHash: "sha256:abc",
        plainVariables: {},
        secretReferences: [],
        resourceReferences: [],
        routeSnapshot: {},
        policyReferences: [],
      },
    });
    const service = revisionService(tx);
    await service.updateIdentity("team-1", "user-1", "env-1", {
      name: "预发",
      reason: "演示对齐改名",
    });
    const createData = tx.environmentConfigRevision.create.mock.calls[0][0].data;
    expect(createData.changeSummary).toBe("演示对齐改名");
  });
});

describe("EnvironmentConfigRevisionService.copyToEnvironments (F447 AC-SET-036)", () => {
  const RESOLVED = {
    plainVariables: { DATABASE_URL: "postgres://staging/db" },
    secretReferences: [{ id: "secret-1", name: "s3_access_key", type: "aws" }],
    resourceReferences: [],
    routeSnapshot: {},
    policyReferences: [],
  };

  function serviceWith(tx: ReturnType<typeof txClient>) {
    return new EnvironmentConfigRevisionService(
      prismaMock(tx),
      { resolve: jest.fn().mockResolvedValue(RESOLVED) } as never,
    );
  }

  it("writes a revision per target environment through the same CAS/audit path", async () => {
    const tx = txClient();
    tx.projectEnvironment.findFirst.mockResolvedValue({
      id: "env-source", projectId: "project-1",
    });
    tx.projectEnvironment.findMany.mockResolvedValue([
      { id: "env-staging", key: "staging", currentConfigRevisionId: "stg-3" },
      { id: "env-preview", key: "preview", currentConfigRevisionId: "prv-1" },
    ]);
    tx.environmentConfigRevision.findFirst.mockResolvedValue({ revision: 3 });
    tx.environmentConfigRevision.create.mockImplementation(({ data }) => ({
      ...data, id: `rev-${data.revision}`, createdAt: new Date(), createdBy: null,
    }));
    tx.projectEnvironment.findUniqueOrThrow.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        id: where.id,
        teamId: "team-1", projectId: "project-1", key: "staging",
        name: "Staging", description: null, baselineRole: "staging",
        config: null,
        currentConfigRevisionId: where.id === "env-preview" ? "prv-1" : "stg-3",
        currentConfigRevision: null,
      }),
    );
    const service = serviceWith(tx);

    const result = await service.copyToEnvironments("team-1", "user-1", "env-source", {
      targets: [
        { environmentId: "env-staging", expectedCurrentRevisionId: "stg-3" },
        { environmentId: "env-preview" },
      ],
      plainVariables: RESOLVED.plainVariables,
      secretReferenceIds: ["secret-1"],
      changeSummary: "从 staging 复用变量与密钥引用",
    });

    expect(tx.environmentConfigRevision.create).toHaveBeenCalledTimes(2);
    const firstCreate = tx.environmentConfigRevision.create.mock.calls[0][0];
    expect(firstCreate.data.environmentId).toBe("env-staging");
    expect(firstCreate.data.changeSummary).toBe("从 staging 复用变量与密钥引用");
    expect(firstCreate.data.plainVariables).toEqual(RESOLVED.plainVariables);
    const secondCreate = tx.environmentConfigRevision.create.mock.calls[1][0];
    expect(secondCreate.data.environmentId).toBe("env-preview");
    // CAS read fresh per target: expectedCurrentRevisionId passed through.
    expect(firstCreate.data.createdById).toBe("user-1");
    expect(tx.projectEnvironment.update).toHaveBeenCalledTimes(2);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(2);
    expect(result.results.map((item) => [item.environmentId, item.ok])).toEqual([
      ["env-staging", true],
      ["env-preview", true],
    ]);
  });

  it("reports a stale target CAS as a per-env conflict without aborting the others", async () => {
    const tx = txClient();
    tx.projectEnvironment.findFirst.mockResolvedValue({
      id: "env-source", projectId: "project-1",
    });
    tx.projectEnvironment.findMany.mockResolvedValue([
      { id: "env-staging", key: "staging", currentConfigRevisionId: "stg-3" },
      { id: "env-preview", key: "preview", currentConfigRevisionId: "prv-1" },
    ]);
    tx.environmentConfigRevision.findFirst.mockResolvedValue({ revision: 3 });
    tx.environmentConfigRevision.create.mockImplementation(({ data }) => ({
      ...data, id: `rev-${data.revision}`, createdAt: new Date(), createdBy: null,
    }));
    const service = serviceWith(tx);
    // Second target sees a stale CAS inside its own create call.
    tx.projectEnvironment.findUniqueOrThrow
      .mockResolvedValueOnce({
        id: "env-staging",
        teamId: "team-1", projectId: "project-1", key: "staging",
        name: "Staging", description: null, baselineRole: "staging",
        config: null, currentConfigRevisionId: "stg-3", currentConfigRevision: null,
      })
      .mockResolvedValueOnce({
        id: "env-preview",
        teamId: "team-1", projectId: "project-1", key: "preview",
        name: "Preview", description: null, baselineRole: "preview",
        config: null, currentConfigRevisionId: "prv-2", currentConfigRevision: null,
      });

    const result = await service.copyToEnvironments("team-1", "user-1", "env-source", {
      targets: [{ environmentId: "env-staging" }, { environmentId: "env-preview" }],
      plainVariables: RESOLVED.plainVariables,
    });

    expect(result.results[0].ok).toBe(true);
    expect(result.results[1].ok).toBe(false);
    expect(result.results[1].error).toContain("已更新");
    expect(tx.environmentConfigRevision.create).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a target environment outside the source project", async () => {
    const tx = txClient();
    tx.projectEnvironment.findFirst.mockResolvedValue({
      id: "env-source", projectId: "project-1",
    });
    tx.projectEnvironment.findMany.mockResolvedValue([
      { id: "env-staging", key: "staging", currentConfigRevisionId: null },
    ]);
    const service = serviceWith(tx);

    await expect(
      service.copyToEnvironments("team-1", "user-1", "env-source", {
        targets: [
          { environmentId: "env-staging" },
          { environmentId: "env-foreign" },
        ],
        plainVariables: { A: "1" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.environmentConfigRevision.create).not.toHaveBeenCalled();
  });

  it("rejects an empty target list", async () => {
    const tx = txClient();
    tx.projectEnvironment.findFirst.mockResolvedValue({
      id: "env-source", projectId: "project-1",
    });
    await expect(
      serviceWith(tx).copyToEnvironments("team-1", "user-1", "env-source", {
        targets: [], plainVariables: { A: "1" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
