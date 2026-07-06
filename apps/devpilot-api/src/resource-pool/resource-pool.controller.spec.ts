import { ResourcePoolAccessService } from "./resource-pool-access.service";
import { ResourcePoolController } from "./resource-pool.controller";
import { ResourcePoolService } from "./resource-pool.service";

describe("ResourcePoolController authorization", () => {
  const req = {
    user: { id: "user-1" },
    teamId: "team-1",
  };

  let resourcePoolService: {
    getPools: jest.Mock;
    getAvailablePools: jest.Mock;
    getPool: jest.Mock;
    getUserAllocations: jest.Mock;
    getProjectAllocations: jest.Mock;
  };
  let accessService: {
    filterReadablePools: jest.Mock;
    assertCanReadPool: jest.Mock;
    assertCanReadProjectAllocations: jest.Mock;
  };
  let controller: ResourcePoolController;

  beforeEach(() => {
    resourcePoolService = {
      getPools: jest.fn(),
      getAvailablePools: jest.fn(),
      getPool: jest.fn(),
      getUserAllocations: jest.fn(),
      getProjectAllocations: jest.fn(),
    };
    accessService = {
      filterReadablePools: jest.fn((_, pools) => Promise.resolve(pools)),
      assertCanReadPool: jest.fn(),
      assertCanReadProjectAllocations: jest.fn(),
    };
    controller = new ResourcePoolController(
      resourcePoolService as unknown as ResourcePoolService,
      accessService as unknown as ResourcePoolAccessService,
    );
  });

  it("filters all resource pools through control read policy", async () => {
    resourcePoolService.getPools.mockResolvedValue([
      { id: "pool-allowed", name: "MySQL Pool" },
      { id: "pool-denied", name: "Redis Pool" },
    ]);
    accessService.filterReadablePools.mockResolvedValue([
      { id: "pool-allowed", name: "MySQL Pool" },
    ]);

    await expect(controller.getPools(req, "mysql")).resolves.toEqual([
      { id: "pool-allowed", name: "MySQL Pool" },
    ]);
    expect(resourcePoolService.getPools).toHaveBeenCalledWith("mysql");
    expect(accessService.filterReadablePools).toHaveBeenCalledWith(req, [
      { id: "pool-allowed", name: "MySQL Pool" },
      { id: "pool-denied", name: "Redis Pool" },
    ]);
  });

  it("filters available resource pools through control read policy", async () => {
    resourcePoolService.getAvailablePools.mockResolvedValue([
      { id: "pool-allowed", name: "Active MySQL Pool" },
      { id: "pool-denied", name: "Active Redis Pool" },
    ]);
    accessService.filterReadablePools.mockResolvedValue([
      { id: "pool-allowed", name: "Active MySQL Pool" },
    ]);

    await expect(controller.getAvailablePools(req, undefined)).resolves.toEqual(
      [{ id: "pool-allowed", name: "Active MySQL Pool" }],
    );
    expect(accessService.filterReadablePools).toHaveBeenCalledWith(req, [
      { id: "pool-allowed", name: "Active MySQL Pool" },
      { id: "pool-denied", name: "Active Redis Pool" },
    ]);
  });

  it("asserts resource pool detail read access before returning the pool", async () => {
    resourcePoolService.getPool.mockResolvedValue({
      id: "pool-1",
      name: "MySQL Pool",
    });
    accessService.assertCanReadPool.mockResolvedValue({ allowed: true });

    await expect(controller.getPool("pool-1", req)).resolves.toEqual({
      id: "pool-1",
      name: "MySQL Pool",
    });
    expect(accessService.assertCanReadPool).toHaveBeenCalledWith(req, "pool-1");
  });

  it("does not return resource pool detail when read access is denied", async () => {
    resourcePoolService.getPool.mockResolvedValue({
      id: "pool-denied",
      name: "Hidden Pool",
    });
    accessService.assertCanReadPool.mockRejectedValue(new Error("denied"));

    await expect(controller.getPool("pool-denied", req)).rejects.toThrow(
      "denied",
    );
  });

  it("loads my allocations within the current team scope", async () => {
    resourcePoolService.getUserAllocations.mockResolvedValue([
      { id: "allocation-1" },
    ]);

    await expect(controller.getMyAllocations(req)).resolves.toEqual([
      { id: "allocation-1" },
    ]);
    expect(resourcePoolService.getUserAllocations).toHaveBeenCalledWith(
      req.teamId,
      req.user.id,
    );
  });

  it("checks project allocation read access before loading allocations", async () => {
    accessService.assertCanReadProjectAllocations.mockRejectedValue(
      new Error("denied"),
    );

    await expect(
      controller.getProjectAllocations("project-1", req),
    ).rejects.toThrow("denied");
    expect(resourcePoolService.getProjectAllocations).not.toHaveBeenCalled();
    expect(accessService.assertCanReadProjectAllocations).toHaveBeenCalledWith(
      req,
      "project-1",
    );
  });
});
