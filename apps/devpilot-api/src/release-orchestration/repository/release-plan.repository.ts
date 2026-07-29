/**
 * ReleasePlan 持久化仓储：创建、查询、状态更新。
 * 不含业务规则，只做 Prisma 读写；秘密值由调用方先脱敏。
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";
import { computeIdempotencyKey } from "../utils/release-hash.utils";

function stageIdempotencyKey(planId: string, key: string, configHash: string): string {
  return computeIdempotencyKey(planId, key, configHash);
}

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

@Injectable()
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

  // 非终态计划 id 列表（供 recovery scheduler 扫描后逐个 advancePlan）
  async listNonTerminal(): Promise<{ id: string }[]> {
    return this.prisma.releasePlan.findMany({
      where: { status: { notIn: ["succeeded", "failed", "canceled"] } },
      select: { id: true },
    });
  }

  // 事务：创建 plan + stages + 依赖边（一次冻结快照）
  async persistPlanWithStages(input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    name: string;
    branch?: string | null;
    commitSha?: string | null;
    planHash: string;
    inputSnapshot: Record<string, unknown>;
    createdByUserId?: string | null;
      stages: Array<{
      key: string;
      name: string;
      type: string;
      executorKind: string;
      applicationId?: string | null;
      applicationServiceId?: string | null;
      environmentId?: string | null;
      serverId?: string | null;
      configSnapshot: Record<string, unknown>;
      configHash?: string | null;
      concurrencyKey?: string | null;
      riskLevel: string;
      required: boolean;
    }>;
    dependencies: Array<{
      stageKey: string;
      dependsOnStageKey: string;
      conditionType: string;
      required: boolean;
    }>;
  }): Promise<{ id: string }> {
    const created = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.releasePlan.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          name: input.name,
          branch: input.branch ?? null,
          commitSha: input.commitSha ?? null,
          source: "manual",
          trigger: "manual",
          mode: "live",
          status: "ready",
          planHash: input.planHash,
          inputSnapshot: input.inputSnapshot as never,
          createdByUserId: input.createdByUserId ?? null,
        },
      });
      for (const stage of input.stages) {
        await tx.releaseStage.create({
          data: {
            releasePlanId: plan.id,
            teamId: input.teamId,
            key: stage.key,
            name: stage.name,
            type: stage.type,
            applicationId: stage.applicationId ?? null,
            applicationServiceId: stage.applicationServiceId ?? null,
            environmentId: stage.environmentId ?? null,
            serverId: stage.serverId ?? null,
            executorKind: stage.executorKind,
            configSnapshot: stage.configSnapshot as never,
            configHash: stage.configHash ?? null,
            idempotencyKey: stageIdempotencyKey(plan.id, stage.key, stage.configHash ?? ""),
            concurrencyKey: stage.concurrencyKey ?? null,
            riskLevel: stage.riskLevel,
            required: stage.required,
            status: "pending",
            currentAttempt: 0,
          },
        });
      }
      const stages = await tx.releaseStage.findMany({
        where: { releasePlanId: plan.id },
        select: { id: true, key: true },
      });
      const keyToId = new Map(stages.map((s) => [s.key, s.id]));
      for (const dep of input.dependencies) {
        const stageId = keyToId.get(dep.stageKey);
        const dependsOnStageId = keyToId.get(dep.dependsOnStageKey);
        if (!stageId || !dependsOnStageId) continue;
        await tx.releaseStageDependency.create({
          data: {
            stageId,
            dependsOnStageId,
            conditionType: dep.conditionType,
            conditionSnapshot: { required: dep.required } as never,
          },
        });
      }
      return plan;
    });
    return { id: created.id };
  }
}
