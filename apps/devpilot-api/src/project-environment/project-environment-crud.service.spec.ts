import { BadRequestException } from "@nestjs/common";
import { ProjectEnvironmentCrudService } from "./project-environment-crud.service";

type Row = Record<string, any>;

function txClient(overrides: Partial<Record<string, any>> = {}) {
  return {
    projectEnvironment: {
      update: jest.fn().mockResolvedValue({ id: "env-1" }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
    },
    environmentVersion: { findFirst: jest.fn().mockResolvedValue(null) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

function service(
  repo: Partial<Record<string, any>>,
  tx: ReturnType<typeof txClient> = txClient(),
  revisionService: Partial<Record<string, any>> = {},
) {
  const prisma = {
    $transaction: jest.fn(async (fn: (client: any) => unknown) => fn(tx)),
    projectEnvironment: tx.projectEnvironment,
    environmentVersion: tx.environmentVersion,
  };
  return new ProjectEnvironmentCrudService(
    repo as never,
    {} as never,
    prisma as never,
    revisionService as never,
  );
}

function envRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "env-1",
    teamId: "team-1",
    projectId: "project-1",
    key: "staging",
    name: "Staging",
    description: null,
    status: "active",
    sortOrder: 10,
    baselineRole: null,
    identityLockedAt: null,
    ...overrides,
  };
}

describe("ProjectEnvironmentCrudService identity lock", () => {
  it("rejects key mutation after a deployment exists", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(envRow()),
      findDeploymentRuns: jest.fn().mockResolvedValue([{ id: "run-1" }]),
    };
    const tx = txClient();
    const crud = service(repo, tx);
    await expect(crud.update("team-1", "user-1", "env-1", { key: "preview" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.projectEnvironment.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("locks the key even after a FAILED deployment run", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(envRow()),
      findDeploymentRuns: jest.fn().mockResolvedValue([
        { id: "run-1", result: "failed" },
      ]),
    };
    const crud = service(repo);
    await expect(crud.update("team-1", "user-1", "env-1", { key: "preview" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects key mutation once identity is locked even without runs", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(
        envRow({ identityLockedAt: new Date() }),
      ),
      findDeploymentRuns: jest.fn().mockResolvedValue([]),
    };
    const crud = service(repo);
    await expect(crud.update("team-1", "user-1", "env-1", { key: "preview" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows key mutation before any run and audits it", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(envRow()),
      findDeploymentRuns: jest.fn().mockResolvedValue([]),
      findProjectEnvironmentServers: jest.fn().mockResolvedValue([]),
    };
    const refreshed = envRow({ key: "preview" });
    repo.findProjectEnvironment.mockResolvedValueOnce(envRow());
    repo.findProjectEnvironment.mockResolvedValueOnce(refreshed);
    const tx = txClient();
    const crud = service(repo, tx);
    const result = await crud.update("team-1", "user-1", "env-1", { key: "preview" });
    expect(result).toEqual(refreshed);
    expect(tx.projectEnvironment.update).toHaveBeenCalledWith({
      where: { id: "env-1" },
      data: { key: "preview" },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "project_environment.key.update",
        summary: "更换环境 key：staging -> preview",
        metadata: { previousKey: "staging", key: "preview" },
      }),
    });
  });
});

describe("ProjectEnvironmentCrudService revision-based identity (AC-SET-014)", () => {
  it("routes name/description edits through updateIdentity and refreshes", async () => {
    const repo = {
      findProjectEnvironment: jest.fn()
        .mockResolvedValueOnce(envRow())
        .mockResolvedValueOnce(envRow({ name: "预发", description: "预发验证环境" })),
    };
    const revisionService = {
      updateIdentity: jest.fn().mockResolvedValue({ environment: {}, revision: {} }),
    };
    const crud = service(repo, txClient(), revisionService);
    const result = await crud.update("team-1", "user-1", "env-1", {
      name: "预发",
      description: "预发验证环境",
      reason: "演示对齐改名",
    });
    expect(revisionService.updateIdentity).toHaveBeenCalledWith("team-1", "user-1", "env-1", {
      name: "预发",
      description: "预发验证环境",
      reason: "演示对齐改名",
    });
    expect(result.name).toBe("预发");
    expect(result.description).toBe("预发验证环境");
  });

  it("keeps display-name updates available after identity lock via revision", async () => {
    const repo = {
      findProjectEnvironment: jest.fn()
        .mockResolvedValueOnce(envRow({ identityLockedAt: new Date() }))
        .mockResolvedValueOnce(envRow({ identityLockedAt: new Date(), name: "预发" })),
    };
    const revisionService = { updateIdentity: jest.fn().mockResolvedValue({}) };
    const crud = service(repo, txClient(), revisionService);
    const result = await crud.update("team-1", "user-1", "env-1", { name: "预发" });
    expect(result.name).toBe("预发");
    expect(revisionService.updateIdentity).toHaveBeenCalledTimes(1);
  });

  it("does not create a revision for unchanged identity values", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(envRow()),
      findDeploymentRuns: jest.fn().mockResolvedValue([]),
    };
    const revisionService = { updateIdentity: jest.fn() };
    const tx = txClient();
    const crud = service(repo, tx, revisionService);
    await crud.update("team-1", "user-1", "env-1", { name: "Staging", status: "active" });
    expect(revisionService.updateIdentity).not.toHaveBeenCalled();
    expect(tx.projectEnvironment.update).not.toHaveBeenCalled();
  });
});

describe("ProjectEnvironmentCrudService archive guards (AC-SET-012)", () => {
  it("blocks archive of a Staging/Production baseline environment", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(
        envRow({ baselineRole: "production" }),
      ),
    };
    const tx = txClient();
    const crud = service(repo, tx);
    await expect(crud.archive("team-1", "user-1", "env-1"))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(crud.archive("team-1", "user-1", "env-1"))
      .rejects.toThrow("基线环境不允许归档");
    expect(tx.projectEnvironment.update).not.toHaveBeenCalled();
  });

  it("blocks status->archived PUT for a baseline environment", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(
        envRow({ baselineRole: "staging" }),
      ),
    };
    const crud = service(repo);
    await expect(crud.update("team-1", "user-1", "env-1", { status: "archived" }))
      .rejects.toThrow("基线环境不允许归档");
  });

  it("blocks archive when a DeploymentRun exists", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(envRow({ key: "preview" })),
      findDeploymentRuns: jest.fn().mockResolvedValue([{ id: "run-1", result: "failed" }]),
      findProjectEnvironmentServers: jest.fn().mockResolvedValue([]),
    };
    const crud = service(repo);
    await expect(crud.archive("team-1", "user-1", "env-1"))
      .rejects.toThrow("存在运行或绑定记录");
  });

  it("blocks archive when a server binding exists", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(envRow({ key: "preview" })),
      findDeploymentRuns: jest.fn().mockResolvedValue([]),
      findProjectEnvironmentServers: jest.fn().mockResolvedValue([{ id: "b-1" }]),
    };
    const crud = service(repo);
    await expect(crud.archive("team-1", "user-1", "env-1"))
      .rejects.toThrow("存在运行或绑定记录");
  });

  it("blocks archive when an environment version exists", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(envRow({ key: "preview" })),
      findDeploymentRuns: jest.fn().mockResolvedValue([]),
      findProjectEnvironmentServers: jest.fn().mockResolvedValue([]),
    };
    const tx = txClient();
    tx.environmentVersion.findFirst.mockResolvedValue({ id: "ver-1" });
    const crud = service(repo, tx);
    await expect(crud.archive("team-1", "user-1", "env-1"))
      .rejects.toThrow("存在运行或绑定记录");
  });

  it("blocks archive of the last active baseline of a role", async () => {
    const repo = {
      findProjectEnvironment: jest.fn().mockResolvedValue(
        envRow({ key: "legacy", baselineRole: "development" }),
      ),
      findDeploymentRuns: jest.fn().mockResolvedValue([]),
      findProjectEnvironmentServers: jest.fn().mockResolvedValue([]),
    };
    const tx = txClient();
    tx.projectEnvironment.count.mockResolvedValue(0);
    const crud = service(repo, tx);
    await expect(crud.archive("team-1", "user-1", "env-1"))
      .rejects.toThrow("最后一个活动环境");
  });

  it("allows archive of a clean custom environment and audits it in the same tx", async () => {
    const repo = {
      findProjectEnvironment: jest.fn()
        .mockResolvedValueOnce(envRow({ key: "preview" }))
        .mockResolvedValueOnce(envRow({ key: "preview", status: "archived" })),
      findDeploymentRuns: jest.fn().mockResolvedValue([]),
      findProjectEnvironmentServers: jest.fn().mockResolvedValue([]),
    };
    const tx = txClient();
    tx.projectEnvironment.count.mockResolvedValue(1);
    const crud = service(repo, tx);
    const result = await crud.archive("team-1", "user-1", "env-1");
    expect(result.status).toBe("archived");
    expect(tx.projectEnvironment.update).toHaveBeenCalledWith({
      where: { id: "env-1" },
      data: { status: "archived" },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "project_environment.archive",
        summary: "归档环境 Staging (preview)",
        risk: "high",
      }),
    });
  });
});

describe("ProjectEnvironmentCrudService syncFromProject governance (AC-SET-016)", () => {
  it("skips defaults seeding for a governed project with active baselines", async () => {
    const repo = {
      findProject: jest.fn().mockResolvedValue({ id: "project-1", config: null }),
      findProjectEnvironments: jest.fn().mockResolvedValue([]),
    };
    const defaults = { ensureDefaultsForProject: jest.fn() };
    const tx = txClient();
    tx.projectEnvironment.findMany.mockResolvedValue([
      { baselineRole: "staging" },
      { baselineRole: "production" },
    ]);
    const prisma = { $transaction: jest.fn(), projectEnvironment: tx.projectEnvironment };
    const crud = new ProjectEnvironmentCrudService(
      repo as never,
      defaults as never,
      prisma as never,
      {} as never,
    );
    await crud.syncFromProject("team-1", "project-1");
    expect(defaults.ensureDefaultsForProject).not.toHaveBeenCalled();
    expect(repo.findProjectEnvironments).toHaveBeenCalled();
  });

  it("still seeds defaults for a non-governed project", async () => {
    const repo = {
      findProject: jest.fn().mockResolvedValue({ id: "project-1", config: null }),
      findProjectEnvironments: jest.fn().mockResolvedValue([]),
    };
    const defaults = { ensureDefaultsForProject: jest.fn() };
    const tx = txClient();
    tx.projectEnvironment.findMany.mockResolvedValue([]);
    const prisma = { $transaction: jest.fn(), projectEnvironment: tx.projectEnvironment };
    const crud = new ProjectEnvironmentCrudService(
      repo as never,
      defaults as never,
      prisma as never,
      {} as never,
    );
    await crud.syncFromProject("team-1", "project-1");
    expect(defaults.ensureDefaultsForProject).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      null,
    );
  });
});
