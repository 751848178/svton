/**
 * ReleaseStageAttempt 仓储：创建、原子认领、租约续约、终态写入。
 * 并发安全全部依赖 updateMany 的条件 WHERE 子句。
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

export const releaseStageAttemptInclude = {
  releaseStage: true,
  deploymentRun: true,
  serverExecutionJob: true,
  operationApproval: true,
} satisfies Prisma.ReleaseStageAttemptInclude;

export type ReleaseStageAttemptDetail = Prisma.ReleaseStageAttemptGetPayload<{
  include: typeof releaseStageAttemptInclude;
}>;

@Injectable()
export class ReleaseStageAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ReleaseStageAttemptCreateInput) {
    return this.prisma.releaseStageAttempt.create({
      data,
      include: releaseStageAttemptInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.releaseStageAttempt.findUnique({
      where: { id },
      include: releaseStageAttemptInclude,
    });
  }

  // 同一阶段的 active attempt（queued/running）查询
  async findActiveByStage(releaseStageId: string) {
    return this.prisma.releaseStageAttempt.findFirst({
      where: {
        releaseStageId,
        status: { in: ["queued", "running"] },
      },
      include: releaseStageAttemptInclude,
    });
  }

  // 同一阶段最近一次 succeeded attempt（D8 幂等：claim 前查到则短路）
  async findSucceededByStage(
    releaseStageId: string,
  ): Promise<ReleaseStageAttemptDetail | null> {
    return this.prisma.releaseStageAttempt.findFirst({
      where: { releaseStageId, status: "succeeded" },
      orderBy: { finishedAt: "desc" },
      include: releaseStageAttemptInclude,
    });
  }

  // 按 serverExecutionJobId / deploymentRunId 反查（用于恢复回读）
  async findByServerExecutionJobId(serverExecutionJobId: string) {
    return this.prisma.releaseStageAttempt.findFirst({
      where: { serverExecutionJobId },
      include: releaseStageAttemptInclude,
    });
  }

  async findByDeploymentRunId(deploymentRunId: string) {
    return this.prisma.releaseStageAttempt.findFirst({
      where: { deploymentRunId },
      include: releaseStageAttemptInclude,
    });
  }

  // 原子认领：仅当 status=queued 且租约未过期或无租约时，标记 running 并写租约
  async claim(
    id: string,
    owner: string,
    leaseExpiresAt: Date,
  ): Promise<number> {
    const now = new Date();
    const r = await this.prisma.releaseStageAttempt.updateMany({
      where: {
        id,
        status: "queued",
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      },
      data: {
        status: "running",
        leaseOwner: owner,
        leaseExpiresAt,
        heartbeatAt: now,
        startedAt: now,
      },
    });
    return r.count;
  }

  // 心跳续约：仅当仍是 running 且 owner 一致
  async heartbeat(
    id: string,
    owner: string,
    leaseExpiresAt: Date,
  ): Promise<number> {
    const now = new Date();
    const r = await this.prisma.releaseStageAttempt.updateMany({
      where: { id, status: "running", leaseOwner: owner },
      data: { heartbeatAt: now, leaseExpiresAt },
    });
    return r.count;
  }

  // 终态写入：仅当非终态
  async finish(
    id: string,
    data: Pick<
      Prisma.ReleaseStageAttemptUpdateInput,
      "status" | "output" | "logSummary" | "error" | "finishedAt"
    >,
  ): Promise<number> {
    const r = await this.prisma.releaseStageAttempt.updateMany({
      where: { id, status: { in: ["queued", "running"] } },
      data: { ...data, leaseOwner: null, leaseExpiresAt: null },
    });
    return r.count;
  }

  // 关联 deploymentRun / serverExecutionJob / operationApproval（恢复时回填）
  async linkRun(
    id: string,
    data: {
      deploymentRunId?: string | null;
      serverExecutionJobId?: string | null;
      operationApprovalId?: string | null;
    },
  ): Promise<void> {
    await this.prisma.releaseStageAttempt.update({
      where: { id },
      // 使用 unchecked input 以便直接写标量外键
      data: data as Prisma.ReleaseStageAttemptUncheckedUpdateInput,
    });
  }

  async update(id: string, data: Prisma.ReleaseStageAttemptUpdateInput) {
    return this.prisma.releaseStageAttempt.update({
      where: { id },
      data,
      include: releaseStageAttemptInclude,
    });
  }
}
