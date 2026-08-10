import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export async function lockActionableReleaseOrder(
  tx: Prisma.TransactionClient,
  input: { teamId: string; projectId: string; releaseOrderId: string },
) {
  const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM ReleaseOrder
    WHERE id = ${input.releaseOrderId}
      AND teamId = ${input.teamId} AND projectId = ${input.projectId}
    FOR UPDATE
  `;
  const order = rows[0];
  if (!order) {
    throw new NotFoundException("发布单不存在或不属于当前项目");
  }
  if (order.status === "canceled") {
    throw new ConflictException("发布单已撤回，不能创建新的执行记录");
  }
  return order;
}
