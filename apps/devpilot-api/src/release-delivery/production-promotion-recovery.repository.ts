import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProductionPromotionRecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  due(now: Date) {
    return this.prisma.productionPromotionCommand.findMany({
      where: {
        status: "running",
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
        deploymentRun: { status: { in: ["awaiting_validation", "completed"] } },
        releaseRun: { status: { in: ["awaiting_validation", "succeeded"] } },
      },
      select: {
        id: true, teamId: true, projectId: true, actorId: true,
        releaseRunId: true, deploymentRunId: true, candidateHash: true,
        idempotencyKey: true, routeSwitchOperationId: true, phase: true,
        deploymentRun: { select: { environmentId: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 25,
    });
  }

  async convergeCommitted(commandId: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ProductionPromotionCommand
        WHERE id = ${commandId} FOR UPDATE`;
      const command = await tx.productionPromotionCommand.findFirst({
        where: {
          id: commandId, status: "running",
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
          deploymentRun: { status: "completed", environmentVersion: { isNot: null } },
          releaseRun: { status: "succeeded" },
          routeSwitchOperationId: { not: null },
        },
        select: { id: true, routeSwitchOperationId: true },
      });
      if (!command?.routeSwitchOperationId) return false;
      const saga = await tx.siteRouteSwitchRun.findFirst({
        where: { operationId: command.routeSwitchOperationId, status: "committed" },
        select: { id: true },
      });
      if (!saga) return false;
      const updated = await tx.productionPromotionCommand.updateMany({
        where: { id: command.id, status: "running" },
        data: {
          status: "completed", phase: "committing", finishedAt: now,
          leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null,
        },
      });
      return updated.count === 1;
    });
  }
}
