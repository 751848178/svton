import { BadRequestException } from "@nestjs/common";
import { PoolStatus, PoolType } from "./dto/resource-pool.dto";
import { ResourcePoolAllocationLifecycleService } from "./resource-pool-allocation-lifecycle.service";
import { ResourcePoolProvisioningService } from "./resource-pool-provisioning.service";
import { ResourcePoolRepository } from "./resource-pool.repository";

const cryptoService = {
  encryptCbc: jest.fn((value: string) => `encrypted:${value}`),
  decryptCbc: jest.fn((value: string) => {
    if (value === "encrypted-redis-creds") {
      return JSON.stringify({ db: 7, host: "redis.internal", port: 6379 });
    }
    return "{}";
  }),
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

  // CR M1: if persisting the allocation fails after the real DB was created,
  // the just-provisioned resource must be rolled back so it isn't orphaned.
  it("rolls back the provisioned resource when the allocation write fails", async () => {
    const repository = {
      findPoolForAllocation: jest.fn().mockResolvedValue({
        id: "pool-1",
        type: PoolType.MYSQL,
        name: "MySQL Pool",
        endpoint: "mysql.internal:3306",
        adminConfig: "encrypted-admin",
        allocated: 0,
        capacity: 5,
        status: PoolStatus.ACTIVE,
      }),
      createAllocationAndIncrementPool: jest
        .fn()
        .mockRejectedValue(new Error("prisma unique-constraint boom")),
    };
    const provisioning = {
      generateResourceName: jest.fn().mockReturnValue("db_project"),
      provisionResource: jest.fn().mockResolvedValue({ username: "user" }),
      deprovisionResource: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repository, provisioning);

    await expect(
      service.allocateResource(
        { poolId: "pool-1", projectId: "project-abcdef" },
        "user-1",
        "team-1",
      ),
    ).rejects.toThrow(/unique-constraint boom/);

    expect(provisioning.provisionResource).toHaveBeenCalledTimes(1);
    expect(provisioning.deprovisionResource).toHaveBeenCalledTimes(1);
    // Compensating deprovision forwards the in-memory credentials (so a redis
    // slot's `db` can still be targeted even though it was never persisted).
    expect(provisioning.deprovisionResource).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pool-1" }),
      "db_project",
      { username: "user" },
    );
  });

  // CR M2: when the atomic capacity check in the transaction detects a race
  // (the pool filled between the read and the write), the real resource is
  // rolled back and the caller sees a 400, not a 500.
  it("rolls back and rejects as full when the atomic capacity check fails", async () => {
    const repository = {
      findPoolForAllocation: jest.fn().mockResolvedValue({
        id: "pool-1",
        type: PoolType.MYSQL,
        name: "MySQL Pool",
        endpoint: "mysql.internal:3306",
        adminConfig: "encrypted-admin",
        allocated: 1,
        capacity: 5,
        status: PoolStatus.ACTIVE,
      }),
      createAllocationAndIncrementPool: jest
        .fn()
        .mockRejectedValue(new Error("RESOURCE_POOL_FULL")),
    };
    const provisioning = {
      generateResourceName: jest.fn().mockReturnValue("db_project"),
      provisionResource: jest.fn().mockResolvedValue({ username: "user" }),
      deprovisionResource: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repository, provisioning);

    await expect(
      service.allocateResource(
        { poolId: "pool-1", projectId: "project-abcdef" },
        "user-1",
        "team-1",
      ),
    ).rejects.toMatchObject({ message: "Resource pool is full" });

    // Compensating deprovision ran so the real DB isn't orphaned.
    expect(provisioning.deprovisionResource).toHaveBeenCalledTimes(1);
  });

  it("releases an active allocation and reopens a full pool", async () => {
    const repository = {
      findAllocationForRelease: jest.fn().mockResolvedValue({
        id: "allocation-1",
        poolId: "pool-1",
        resourceName: "redis_project",
        credentials: "encrypted-redis-creds",
        status: "active",
        pool: {
          type: PoolType.REDIS,
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

    // CR H1: deprovision must receive the decrypted allocation credentials
    // (carrying the allocated redis db), not just the pool + resourceName.
    expect(provisioning.deprovisionResource).toHaveBeenCalledWith(
      expect.objectContaining({ type: PoolType.REDIS }),
      "redis_project",
      expect.objectContaining({ db: 7 }),
    );
    expect(cryptoService.decryptCbc).toHaveBeenCalledWith("encrypted-redis-creds");
    expect(repository.releaseAllocationAndDecrementPool).toHaveBeenCalledWith({
      allocation: expect.objectContaining({
        id: "allocation-1",
        poolId: "pool-1",
      }),
      nextPoolStatus: PoolStatus.ACTIVE,
    });
  });
});
