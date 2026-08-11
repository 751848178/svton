import { ConflictException } from "@nestjs/common";
import { ProjectGovernanceServiceTopologyService } from "./project-governance-service-topology.service";

describe("ProjectGovernanceServiceTopologyService", () => {
  const service = new ProjectGovernanceServiceTopologyService();

  it("materializes the same stable component into both governed baselines only", async () => {
    const tx = transaction([source()]);
    await service.materialize(tx as never, {
      teamId: "team-1",
      projectId: "project-1",
      environments: [baseline("staging"), baseline("production")],
    });

    expect(tx.applicationService.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        releaseComponentKey: { not: null },
        environment: { baselineRole: { in: ["staging", "production"] } },
      }),
    }));
    expect(tx.applicationService.upsert).toHaveBeenCalledTimes(2);
    expect(tx.applicationService.upsert.mock.calls.map((call) =>
      call[0].where.environmentId_releaseComponentKey)).toEqual([
      { environmentId: "env-staging", releaseComponentKey: "api" },
      { environmentId: "env-production", releaseComponentKey: "api" },
    ]);
    for (const [input] of tx.applicationService.upsert.mock.calls) {
      expect(input.create).not.toHaveProperty("serverId");
      expect(input.create).not.toHaveProperty("siteId");
      expect(input.create).not.toHaveProperty("managedResourceId");
      expect(input.create).not.toHaveProperty("env");
      expect(input.create).not.toHaveProperty("secretKeyIds");
    }
  });

  it("fails closed when baseline templates disagree for one stable key", async () => {
    const tx = transaction([source(), { ...source(), id: "service-2", runtime: "node20" }]);
    await expect(service.materialize(tx as never, {
      teamId: "team-1",
      projectId: "project-1",
      environments: [baseline("staging"), baseline("production")],
    })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.applicationService.upsert).not.toHaveBeenCalled();
  });
});

function source() {
  return {
    id: "service-1",
    applicationId: "app-1",
    releaseComponentKey: "api",
    name: "API",
    kind: "container",
    runtime: "node22",
    ports: [{ port: 3000 }],
    deployConfig: { deployCommand: "node dist/main.js" },
    metadata: { repositoryAnalysis: { environment: [] } },
  };
}

function baseline(role: "staging" | "production") {
  return {
    id: `env-${role}`,
    key: role,
    name: role,
    baselineRole: role,
    status: "active",
    identityLockedAt: new Date(),
  } as never;
}

function transaction(rows: ReturnType<typeof source>[]) {
  return {
    applicationService: {
      findMany: jest.fn().mockResolvedValue(rows),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
}
