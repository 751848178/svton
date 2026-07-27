/**
 * ReleaseStage 仓储：阶段定义读取、状态与派生字段更新。
 */
import type { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

export const releaseStageDetailInclude = {
  dependencies: true,
  dependents: true,
  attempts: { orderBy: { attemptNo: "desc" } },
  releasePlan: true,
  application: true,
  applicationService: true,
  environment: true,
} satisfies Prisma.ReleaseStageInclude;

export type ReleaseStageDetail = Prisma.ReleaseStageGetPayload<{
  include: typeof releaseStageDetailInclude;
}>;

export class ReleaseStageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.releaseStage.findUnique({
      where: { id },
      include: releaseStageDetailInclude,
    });
  }

  async findByPlanAndKey(releasePlanId: string, key: string) {
    return this.prisma.releaseStage.findUnique({
      where: { releasePlanId_key: { releasePlanId, key } },
      include: releaseStageDetailInclude,
    });
  }

  async listByPlan(releasePlanId: string) {
    return this.prisma.releaseStage.findMany({
      where: { releasePlanId },
      include: releaseStageDetailInclude,
      orderBy: { createdAt: "asc" },
    });
  }

  // 条件状态更新（合法转换时调用）
  async updateStatusIf(
    id: string,
    fromStatus: string[],
    data: Pick<
      Prisma.ReleaseStageUpdateInput,
      "status" | "blockedReason" | "currentAttempt"
    >,
  ): Promise<number> {
    const r = await this.prisma.releaseStage.updateMany({
      where: { id, status: { in: fromStatus } },
      data,
    });
    return r.count;
  }

  async update(id: string, data: Prisma.ReleaseStageUpdateInput) {
    return this.prisma.releaseStage.update({
      where: { id },
      data,
      include: releaseStageDetailInclude,
    });
  }

  // 并发键占用查询：同 concurrencyKey 是否存在 active attempt
  async findActiveByConcurrencyKey(concurrencyKey: string, excludeStageId?: string) {
    return this.prisma.releaseStage.findFirst({
      where: {
        concurrencyKey,
        id: excludeStageId ? { not: excludeStageId } : undefined,
        status: { in: ["queued", "running"] },
      },
      select: { id: true, key: true, status: true },
    });
  }
}
