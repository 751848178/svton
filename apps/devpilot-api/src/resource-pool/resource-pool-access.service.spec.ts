import { ControlAccessPolicyService } from "../control-access-policy";
import { ResourcePoolAccessService } from "./resource-pool-access.service";
import { ResourcePoolRepository } from "./resource-pool.repository";

const req = {
  teamId: "team-1",
  user: { id: "user-1" },
};

describe("ResourcePoolAccessService", () => {
  let accessPolicyService: {
    canRead: jest.Mock;
    assertCanRead: jest.Mock;
    assertCanSelfServiceWrite: jest.Mock;
  };
  let repository: {
    findProjectScope: jest.Mock;
    findAllocationScope: jest.Mock;
  };
  let service: ResourcePoolAccessService;

  beforeEach(() => {
    accessPolicyService = {
      canRead: jest.fn(),
      assertCanRead: jest.fn(),
      assertCanSelfServiceWrite: jest.fn(),
    };
    repository = {
      findProjectScope: jest.fn(),
      findAllocationScope: jest.fn(),
    };
    service = new ResourcePoolAccessService(
      accessPolicyService as unknown as ControlAccessPolicyService,
      repository as unknown as ResourcePoolRepository,
    );
  });

  it("resolves allocation input scope from a team-owned project", async () => {
    repository.findProjectScope.mockResolvedValue({ id: "project-1" });

    await expect(
      service.resolveAllocationInputAccessScope("team-1", {
        poolId: "pool-1",
        projectId: "project-1",
      }),
    ).resolves.toEqual({ projectId: "project-1", environmentId: null });
    expect(repository.findProjectScope).toHaveBeenCalledWith(
      "team-1",
      "project-1",
    );
  });

  it("resolves allocation release scope within the current team", async () => {
    repository.findAllocationScope.mockResolvedValue({
      id: "allocation-1",
      projectId: "project-1",
    });

    await expect(
      service.getAllocationAccessScope("team-1", "allocation-1"),
    ).resolves.toEqual({ projectId: "project-1", environmentId: null });
    expect(repository.findAllocationScope).toHaveBeenCalledWith(
      "team-1",
      "allocation-1",
    );
  });

  it("filters readable pools through resource pool read policy", async () => {
    accessPolicyService.canRead.mockImplementation(({ targetId }) =>
      Promise.resolve(targetId === "pool-allowed"),
    );

    await expect(
      service.filterReadablePools(req, [
        { id: "pool-allowed", name: "MySQL Pool" },
        { id: "pool-denied", name: "Redis Pool" },
      ]),
    ).resolves.toEqual([{ id: "pool-allowed", name: "MySQL Pool" }]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: req.teamId,
        actorId: req.user.id,
        category: "resource_pool",
        action: "resource_pool.read",
        targetType: "resource_pool",
        targetId: "pool-denied",
        risk: "low",
      }),
    );
  });

  it("asserts project allocation read access", async () => {
    await service.assertCanReadProjectAllocations(req, "project-1");

    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        action: "resource_allocation.read",
        targetType: "resource_allocation",
        targetId: "project-1",
        risk: "low",
      }),
    );
  });

  it("asserts self-service allocation and release writes with scoped project context", async () => {
    const scope = { projectId: "project-1", environmentId: "env-1" };

    await service.assertCanAllocate(
      req,
      { poolId: "pool-1", projectId: "project-1" },
      scope,
    );
    await service.assertCanRelease(req, "allocation-1", scope);

    expect(
      accessPolicyService.assertCanSelfServiceWrite,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        projectId: "project-1",
        environmentId: "env-1",
        action: "resource_pool.allocate",
        targetType: "resource_pool",
        targetId: "pool-1",
        risk: "medium",
      }),
    );
    expect(
      accessPolicyService.assertCanSelfServiceWrite,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        projectId: "project-1",
        environmentId: "env-1",
        action: "resource_pool.release",
        targetType: "resource_allocation",
        targetId: "allocation-1",
        risk: "high",
      }),
    );
  });
});
