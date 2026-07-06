import { BadRequestException } from "@nestjs/common";
import { PoolStatus, PoolType } from "./dto/resource-pool.dto";
import { ResourcePoolAllocationLifecycleService } from "./resource-pool-allocation-lifecycle.service";
import { ResourcePoolProvisioningService } from "./resource-pool-provisioning.service";
import { ResourcePoolRepository } from "./resource-pool.repository";

const cryptoService = {
  encryptCbc: jest.fn((value: string) => `encrypted:${value}`),
};

function createService(repository: unknown, provisioning: unknown) {
  return new ResourcePoolAllocationLifecycleService(
    repository as ResourcePoolRepository,
    cryptoService as never,
    provisioning as ResourcePoolProvisioningService,
  );
}

describe("ResourcePoolAllocationLifecycleService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allocates a resource and delegates encrypted persistence inputs", async () => {
    const repository = {
      findPoolForAllocation: jest.fn().mockResolvedValue({
        id: "pool-1",
        type: PoolType.MYSQL,
        name: "MySQL Pool",
        endpoint: "mysql.internal:3306",
        adminConfig: "encrypted-admin",
        allocated: 0,
        capacity: 1,
        status: PoolStatus.ACTIVE,
      }),
      createAllocationAndIncrementPool: jest.fn().mockResolvedValue({
        id: "allocation-1",
        resourceName: "db_project",
      }),
    };
    const provisioning = {
      generateResourceName: jest.fn().mockReturnValue("db_project"),
      provisionResource: jest.fn().mockResolvedValue({ username: "user" }),
    };
    const service = createService(repository, provisioning);

    await expect(
      service.allocateResource(
        { poolId: "pool-1", projectId: "project-abcdef" },
        "user-1",
        "team-1",
      ),
    ).resolves.toEqual({
      id: "allocation-1",
      type: PoolType.MYSQL,
      resourceName: "db_project",
      credentials: { username: "user" },
    });

    expect(repository.createAllocationAndIncrementPool).toHaveBeenCalledWith({
      pool: expect.objectContaining({ id: "pool-1" }),
      projectId: "project-abcdef",
      teamId: "team-1",
      userId: "user-1",
      resourceName: "db_project",
      encryptedCredentials: 'encrypted:{"username":"user"}',
      nextPoolStatus: PoolStatus.FULL,
    });
  });

  it("rejects allocation when the pool is already full", async () => {
    const repository = {
      findPoolForAllocation: jest.fn().mockResolvedValue({
        allocated: 2,
        capacity: 2,
        status: PoolStatus.ACTIVE,
      }),
      createAllocationAndIncrementPool: jest.fn(),
    };
    const provisioning = {
      generateResourceName: jest.fn(),
      provisionResource: jest.fn(),
    };
    const service = createService(repository, provisioning);

    await expect(
      service.allocateResource(
        { poolId: "pool-1", projectId: "project-abcdef" },
        "user-1",
        "team-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createAllocationAndIncrementPool).not.toHaveBeenCalled();
    expect(provisioning.provisionResource).not.toHaveBeenCalled();
  });

  it("releases an active allocation and reopens a full pool", async () => {
    const repository = {
      findAllocationForRelease: jest.fn().mockResolvedValue({
        id: "allocation-1",
        poolId: "pool-1",
        resourceName: "db_project",
        status: "active",
        pool: {
          type: PoolType.MYSQL,
          status: PoolStatus.FULL,
          adminConfig: "encrypted-admin",
        },
      }),
      releaseAllocationAndDecrementPool: jest.fn().mockResolvedValue(undefined),
    };
    const provisioning = {
      deprovisionResource: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repository, provisioning);

    await expect(
      service.releaseResource("team-1", "allocation-1"),
    ).resolves.toEqual({ success: true });

    expect(provisioning.deprovisionResource).toHaveBeenCalledWith(
      expect.objectContaining({ type: PoolType.MYSQL }),
      "db_project",
    );
    expect(repository.releaseAllocationAndDecrementPool).toHaveBeenCalledWith({
      allocation: expect.objectContaining({
        id: "allocation-1",
        poolId: "pool-1",
      }),
      nextPoolStatus: PoolStatus.ACTIVE,
    });
  });
});
