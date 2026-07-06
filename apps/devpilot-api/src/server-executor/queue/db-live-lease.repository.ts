import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AcquireLeaseInput,
  AcquireLeaseResult,
  LeaseRecord,
} from "./job-queue.port";

export class DbLiveLeaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireLiveLease(
    input: AcquireLeaseInput,
  ): Promise<AcquireLeaseResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.ttlMs);
    try {
      const lease = await this.prisma.serverExecutionLease.create({
        data: {
          teamId: input.teamId,
          actorId: input.actorId,
          serverId: input.serverId,
          activeKey: input.activeKey,
          operationKey: input.operationKey,
          adapterKey: input.adapterKey,
          transport: input.transport,
          dryRun: input.dryRun,
          status: "running",
          expiresAt,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          operationKey: true,
          adapterKey: true,
          acquiredAt: true,
          expiresAt: true,
        },
      });
      return { lease: lease as LeaseRecord };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;

      const blocking = await this.prisma.serverExecutionLease.findFirst({
        where: { activeKey: input.activeKey, status: "running" },
        orderBy: { acquiredAt: "asc" },
        select: {
          id: true,
          operationKey: true,
          acquiredAt: true,
          expiresAt: true,
        },
      });
      return {
        blocked: {
          blockingLeaseId: blocking?.id,
          blockingOperationKey: blocking?.operationKey,
          blockingAcquiredAt: blocking?.acquiredAt ?? undefined,
          blockingExpiresAt: blocking?.expiresAt ?? undefined,
        },
      };
    }
  }

  async releaseLiveLease(leaseId: string, status: string): Promise<void> {
    await this.prisma.serverExecutionLease.updateMany({
      where: { id: leaseId, status: "running" },
      data: { status, activeKey: null, releasedAt: new Date() },
    });
  }

  async expireStaleLeases(now: Date, teamId?: string): Promise<number> {
    const result = await this.prisma.serverExecutionLease.updateMany({
      where: {
        teamId,
        status: "running",
        expiresAt: { lte: now },
      },
      data: { status: "expired", activeKey: null, releasedAt: now },
    });
    return result.count;
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
