import { PrismaService } from "../prisma/prisma.service";
import { PoolStatus } from "./dto/resource-pool.dto";
import { ResourcePoolRepository } from "./resource-pool.repository";

describe("ResourcePoolRepository", () => {
  it("loads available pools with active status and type filters", async () => {
    const prisma = {
      resourcePool: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const repository = new ResourcePoolRepository(
      prisma as unknown as PrismaService,
    );

    await repository.findActivePools("mysql");

    expect(prisma.resourcePool.findMany).toHaveBeenCalledWith({
      where: { type: "mysql", status: PoolStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    });
  });

  it("creates allocation and increments pool in one transaction", async () => {
    const tx = {
      resourcePool: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      resourceAllocation: {
        create: jest.fn().mockResolvedValue({ id: "allocation-1" }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const repository = new ResourcePoolRepository(
      prisma as unknown as PrismaService,
    );

    await repository.createAllocationAndIncrementPool({
      pool: { id: "pool-1", capacity: 5 },
      projectId: "project-1",
      teamId: "team-1",
      userId: "user-1",
      resourceName: "db_project",
      encryptedCredentials: "encrypted-creds",
      nextPoolStatus: PoolStatus.FULL,
    });

    // CR M2: the increment is a conditional updateMany that re-checks capacity
    // atomically (allocated < capacity), preventing concurrent over-allocation.
    expect(tx.resourcePool.updateMany).toHaveBeenCalledWith({
      where: { id: "pool-1", allocated: { lt: 5 } },
      data: {
        allocated: { increment: 1 },
        status: PoolStatus.FULL,
      },
    });
    expect(tx.resourceAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        poolId: "pool-1",
        projectId: "project-1",
        teamId: "team-1",
        userId: "user-1",
        resourceName: "db_project",
        credentials: "encrypted-creds",
        status: "active",
      }),
    });
  });

  // CR M2: if the pool filled between the read and the write, the conditional
  // updateMany matches zero rows and the transaction throws so it rolls back.
  it("rejects allocation when the atomic capacity check finds the pool full", async () => {
    const tx = {
      resourcePool: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      resourceAllocation: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const repository = new ResourcePoolRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repository.createAllocationAndIncrementPool({
        pool: { id: "pool-1", capacity: 2 },
        projectId: "project-1",
        teamId: "team-1",
        userId: "user-1",
        resourceName: "db_project",
        encryptedCredentials: "encrypted-creds",
        nextPoolStatus: PoolStatus.FULL,
      }),
    ).rejects.toThrow(/RESOURCE_POOL_FULL/);
    expect(tx.resourceAllocation.create).not.toHaveBeenCalled();
  });

  it("releases allocation and decrements pool in one transaction", async () => {
    const tx = {
      resourceAllocation: { update: jest.fn().mockResolvedValue({}) },
      resourcePool: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const repository = new ResourcePoolRepository(
      prisma as unknown as PrismaService,
    );

    await repository.releaseAllocationAndDecrementPool({
      allocation: { id: "allocation-1", poolId: "pool-1" },
      nextPoolStatus: PoolStatus.ACTIVE,
    });

    expect(tx.resourceAllocation.update).toHaveBeenCalledWith({
      where: { id: "allocation-1" },
      data: expect.objectContaining({ status: "released" }),
    });
    expect(tx.resourcePool.update).toHaveBeenCalledWith({
      where: { id: "pool-1" },
      data: {
        allocated: { decrement: 1 },
        status: PoolStatus.ACTIVE,
      },
    });
  });
});
