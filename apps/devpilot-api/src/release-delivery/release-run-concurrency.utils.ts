import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/**
 * 环境级并发守卫（AC-POLICY-006）：同一生产环境同时最多允许 1 个
 * 进行中的 ReleaseRun（awaiting_approval | running | awaiting_validation）。
 *
 * 两条写路径（ReleaseProductionRepository.confirm 与
 * EnvironmentVersionRecoveryRepository.confirm）必须先对目标环境行加
 * FOR UPDATE 锁（与 lockActionableReleaseOrder 的顺序一致：先发布单行、
 * 后环境行），再执行活跃运行检查，使并发 confirm 串行化、只有第一个
 * 成功创建运行。
 */
export const ACTIVE_RELEASE_RUN_STATUSES = [
  "awaiting_approval",
  "running",
  "awaiting_validation",
] as const;

export async function lockProductionEnvironmentForRelease(
  tx: Prisma.TransactionClient,
  input: { teamId: string; projectId: string; environmentId: string },
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM ProjectEnvironment
    WHERE id = ${input.environmentId}
      AND teamId = ${input.teamId} AND projectId = ${input.projectId}
    FOR UPDATE
  `);
  if (rows.length === 0) {
    throw new NotFoundException("生产环境不存在或不属于当前项目");
  }
  return rows[0];
}

export async function assertNoActiveReleaseRunForEnvironment(
  tx: Prisma.TransactionClient,
  input: { teamId: string; projectId: string; environmentId: string },
) {
  const active = await tx.releaseRun.findFirst({
    where: {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      status: { in: [...ACTIVE_RELEASE_RUN_STATUSES] },
    },
    select: { id: true, mode: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  if (active) {
    const label = active.mode === "recovery" ? "恢复发布" : "标准发布";
    throw new ConflictException(
      `生产环境已有进行中的发布运行（${label} · ${active.status}），同一环境同时只允许一个运行；请等待其完成或先撤销后重试`,
    );
  }
  return active;
}
