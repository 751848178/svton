/**
 * ReleasePlan 持久化仓储：创建、查询、状态更新。
 * 不含业务规则，只做 Prisma 读写；秘密值由调用方先脱敏。
 */
import type { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

export const releasePlanDetailInclude = {
  stages: {
    include: {
      releasePlan: { select: { id: true, projectId: true, environmentId: true, teamId: true } },
      dependencies: true,
      dependents: true,
      attempts: {
        orderBy: { attemptNo: "desc" },
        include: {
          operationApproval: { select: { id: true, status: true, consumedAt: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  environment: true,
  project: true,
  createdBy: true,
  events: { orderBy: { createdAt: "desc" }, take: 100 },
} satisfies Prisma.ReleasePlanInclude;

export type ReleasePlanDetail = Prisma.ReleasePlanGetPayload<{
  include: typeof releasePlanDetailInclude;
}>;

export class ReleasePlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ReleasePlanCreateInput) {
    return this.prisma.releasePlan.create({
      data,
      include: releasePlanDetailInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.releasePlan.findUnique({
      where: { id },
      include: releasePlanDetailInclude,
    });
  }

  async list(params: {
    teamId: string;
    projectId?: string;
    environmentId?: string;
    status?: string;
    take?: number;
  }) {
    return this.prisma.releasePlan.findMany({
      where: {
        teamId: params.teamId,
        projectId: params.projectId,
        environmentId: params.environmentId,
        status: params.status,
      },
      include: releasePlanDetailInclude,
      orderBy: { createdAt: "desc" },
      take: Math.min(params.take ?? 50, 100),
    });
  }

  // 条件更新：仅当 fromStatus 匹配时更新，返回更新计数（用于并发安全的状态迁移）
  async updateStatusIf(
    id: string,
    fromStatus: string[],
    data: Prisma.ReleasePlanUpdateInput,
  ): Promise<number> {
    const r = await this.prisma.releasePlan.updateMany({
      where: { id, status: { in: fromStatus } },
      data,
    });
    return r.count;
  }

  async update(id: string, data: Prisma.ReleasePlanUpdateInput) {
    return this.prisma.releasePlan.update({
      where: { id },
      data,
      include: releasePlanDetailInclude,
    });
  }
}
