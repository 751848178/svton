import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PoolStatus } from "./dto/resource-pool.dto";

@Injectable()
export class ResourcePoolRepository {
  constructor(private readonly prisma: PrismaService) {}

  createPool(data: Record<string, unknown>) {
    return (this.prisma as any).resourcePool.create({ data });
  }

  findPools(type?: string) {
    return (this.prisma as any).resourcePool.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  findActivePools(type?: string) {
    return (this.prisma as any).resourcePool.findMany({
      where: {
        ...(type ? { type } : {}),
        status: PoolStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findPoolDetail(id: string) {
    return (this.prisma as any).resourcePool.findUnique({
      where: { id },
      include: {
        allocations: {
          where: { status: "active" },
          include: { project: true, user: true },
        },
      },
    });
  }

  updatePool(id: string, data: Record<string, unknown>) {
    return (this.prisma as any).resourcePool.update({
      where: { id },
      data,
    });
  }

  findPoolForDelete(id: string) {
    return (this.prisma as any).resourcePool.findUnique({
      where: { id },
      include: { allocations: { where: { status: "active" } } },
    });
  }

  deletePool(id: string) {
    return (this.prisma as any).resourcePool.delete({ where: { id } });
  }

  findPoolForAllocation(poolId: string) {
    return (this.prisma as any).resourcePool.findUnique({
      where: { id: poolId },
    });
  }

  createAllocationAndIncrementPool(input: {
    pool: any;
    projectId: string;
    teamId: string;
    userId: string;
    resourceName: string;
    encryptedCredentials: string;
    nextPoolStatus: string;
  }) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      // M2: atomically re-check capacity inside the transaction. `updateMany`
      // only touches the row while `allocated < capacity`, so two concurrent
      // allocations cannot both pass and over-allocate. If `count === 0` the
      // pool filled between the read and the write — roll back and reject.
      const increment = await tx.resourcePool.updateMany({
        where: { id: input.pool.id, allocated: { lt: input.pool.capacity } },
        data: {
          allocated: { increment: 1 },
          status: input.nextPoolStatus,
        },
      });
      if (increment.count !== 1) {
        throw new Error("RESOURCE_POOL_FULL");
      }

      return tx.resourceAllocation.create({
        data: {
          poolId: input.pool.id,
          projectId: input.projectId,
          teamId: input.teamId,
          userId: input.userId,
          resourceName: input.resourceName,
          credentials: input.encryptedCredentials,
          config: {},
          status: "active",
        },
      });
    });
  }

  findAllocationForRelease(teamId: string, allocationId: string) {
    return (this.prisma as any).resourceAllocation.findFirst({
      where: { id: allocationId, teamId },
      include: { pool: true },
    });
  }

  releaseAllocationAndDecrementPool(input: {
    allocation: any;
    nextPoolStatus: string;
  }) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      await tx.resourceAllocation.update({
        where: { id: input.allocation.id },
        data: {
          status: "released",
          releasedAt: new Date(),
        },
      });

      await tx.resourcePool.update({
        where: { id: input.allocation.poolId },
        data: {
          allocated: { decrement: 1 },
          status: input.nextPoolStatus,
        },
      });
    });
  }

  findProjectAllocations(teamId: string, projectId: string) {
    return (this.prisma as any).resourceAllocation.findMany({
      where: { teamId, projectId, status: "active" },
      include: { pool: true },
    });
  }

  findUserAllocations(teamId: string, userId: string) {
    return (this.prisma as any).resourceAllocation.findMany({
      where: { teamId, userId },
      include: { pool: true, project: true },
      orderBy: { createdAt: "desc" },
    });
  }

  findProjectScope(teamId: string, projectId: string) {
    return (this.prisma as any).project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true },
    });
  }

  findAllocationScope(teamId: string, allocationId: string) {
    return (this.prisma as any).resourceAllocation.findFirst({
      where: { id: allocationId, teamId },
      select: { id: true, projectId: true },
    });
  }
}
