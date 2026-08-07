import { ProjectGovernanceBaselineService } from "./project-governance-baseline.service";

function txClient() {
  return {
    projectEnvironment: {
      upsert: jest.fn().mockImplementation(({ create, update, where }) => ({
        id: where.projectId_key.key === "staging" ? "env-staging" : "env-production",
        ...create,
        ...update,
        currentConfigRevisionId: null,
      })),
      update: jest.fn().mockImplementation(({ where, data }) => ({ id: where.id, ...data })),
    },
    environmentConfigRevision: {
      upsert: jest.fn().mockImplementation(({ create }) => ({ ...create, id: `rev-${create.environmentId}` })),
    },
  };
}

describe("ProjectGovernanceBaselineService.ensure no resurrection (AC-SET-012)", () => {
  it("creates active baselines on first finalize", async () => {
    const tx = txClient();
    const service = new ProjectGovernanceBaselineService();
    const result = await service.ensure(tx as never, {
      teamId: "team-1",
      projectId: "project-1",
      actorId: "user-1",
    });
    expect(result.map((env) => env.baselineRole).sort()).toEqual(["production", "staging"]);
    const stagingUpsert = tx.projectEnvironment.upsert.mock.calls.find(
      (call) => call[0].create?.key === "staging",
    )[0];
    expect(stagingUpsert.create.status).toBe("active");
    expect(stagingUpsert.create.baselineRole).toBe("staging");
  });

  it("does not resurrect an archived baseline on re-finalize", async () => {
    const tx = txClient();
    tx.projectEnvironment.upsert.mockImplementation(({ create, update, where }) => {
      const key = where.projectId_key.key;
      return {
        id: key === "staging" ? "env-staging" : "env-production",
        key,
        baselineRole: key,
        currentConfigRevisionId: null,
        ...(key === "staging" ? { status: "archived" } : { status: "active" }),
      };
    });
    const service = new ProjectGovernanceBaselineService();
    await service.ensure(tx as never, {
      teamId: "team-1",
      projectId: "project-1",
      actorId: "user-1",
    });
    const stagingUpsert = tx.projectEnvironment.upsert.mock.calls.find(
      (call) => call[0].create?.key === "staging",
    )[0];
    expect(stagingUpsert.update.status).toBeUndefined();
    expect(stagingUpsert.update.name).toBeUndefined();
    expect(stagingUpsert.update.baselineRole).toBe("staging");
    expect(tx.projectEnvironment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "active" }) }),
    );
  });

  it("keeps the edited display name on re-finalize", async () => {
    const tx = txClient();
    tx.projectEnvironment.upsert.mockImplementation(({ update, where }) => ({
      id: where.projectId_key.key,
      key: where.projectId_key.key,
      name: "预发环境",
      baselineRole: where.projectId_key.key,
      currentConfigRevisionId: null,
    }));
    const service = new ProjectGovernanceBaselineService();
    await service.ensure(tx as never, {
      teamId: "team-1",
      projectId: "project-1",
      actorId: "user-1",
    });
    const stagingUpsert = tx.projectEnvironment.upsert.mock.calls.find(
      (call) => call[0].create?.key === "staging",
    )[0];
    expect(stagingUpsert.update.name).toBeUndefined();
  });
});
