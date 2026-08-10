import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReleaseOrderWithdrawRepository {
  constructor(private readonly prisma: PrismaService) {}

  withdraw(input: {
    teamId: string;
    actorId: string;
    projectId: string;
    releaseOrderId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM ReleaseOrder
        WHERE id = ${input.releaseOrderId}
          AND teamId = ${input.teamId} AND projectId = ${input.projectId}
        FOR UPDATE
      `;
      const order = rows[0];
      if (!order) return null;
      if (order.status === "canceled") return { changed: false };
      await tx.releaseOrder.update({
        where: { id: order.id },
        data: { status: "canceled" },
      });
      await tx.auditEvent.create({
        data: {
          teamId: input.teamId,
          actorId: input.actorId,
          projectId: input.projectId,
          category: "release",
          action: "project.release_order.withdraw",
          targetType: "release_order",
          targetId: order.id,
          risk: "high",
          status: "completed",
          summary: "发布单已撤回；既有执行与环境版本历史保持不变",
          metadata: {
            persistedStatus: "canceled",
            preservesExecutionHistory: true,
          },
        },
      });
      return { changed: true };
    });
  }
}
