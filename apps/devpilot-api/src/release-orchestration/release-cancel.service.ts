/**
 * 发布计划取消服务（P0-3）：从 release-plan.service 抽离的单一职责——取消发布计划。
 *
 * 取消语义（P0-3 修复）：
 *   1. 先尽力取消真实外部作业（SEJ/DeploymentRun 底层 SEJ），在事务外 best-effort。
 *   2. 单一事务内用 plan 级 CAS 决定取消所有权。CAS 命中 0 行（plan 已被并发 finalize/
 *      cancel 推进终态）→ 事务内短路返回 lost，不动 stages/attempts/leases、不写虚假事件。
 *
 * 旧实现未检查 plan updateMany 影响行数 → finalize 抢先把 plan→succeeded 后，cancel 的
 * plan CAS 命中 0 行，但 cancel 仍翻 stages/attempts 并写 plan_canceled 事件 → 出现
 * plan=succeeded / stage=canceled / event=plan_canceled 的不一致终态。
 *
 * 外部 SEJ/DeploymentRun 取消仍保留可诊断日志，但不破坏 DB 终态一致性。
 * cancel 是逃生通道：feature flag 关闭时仍可用（控制器 cancel 路由有意不守 flag）。
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorService } from "../server-executor/server-executor.service";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { assertLegalPlanTransition } from "./utils/release-state-machine.utils";
import { RELEASE_AUDIT_ACTIONS } from "./types/release-orchestration.types";

@Injectable()
export class ReleaseCancelService {
  private readonly logger = new Logger(ReleaseCancelService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly planRepo: ReleasePlanRepository,
    private readonly serverExecutor: ServerExecutorService,
  ) {}

  async cancel(teamId: string, planId: string, actorId: string): Promise<void> {
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.teamId !== teamId) throw new NotFoundException("发布计划不存在");
    if ((["succeeded", "canceled"] as string[]).includes(plan.status)) {
      throw new ConflictException("计划已终态，不可取消");
    }
    assertLegalPlanTransition(plan.status as never, "canceled");

    // 1. 取消真实外部作业（best-effort，事务外执行远程调用）。
    //    每个 DeploymentRun 都有底层 SEJ（architect D4），故 DR 经底层 SEJ 取消。
    const activeAttempts = await this.prisma.releaseStageAttempt.findMany({
      where: {
        releaseStage: { releasePlanId: planId },
        status: { in: ["queued", "running"] },
      },
      select: {
        id: true,
        serverExecutionJobId: true,
        deploymentRunId: true,
      },
    });
    for (const attempt of activeAttempts) {
      await this.cancelAttemptExternalJob(teamId, actorId, attempt);
    }

    // 2. 单一事务：plan CAS 决定所有权，命中才翻 stages/attempts/leases + 写事件。
    const now = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const cas = await tx.releasePlan.updateMany({
        where: { id: planId, status: { notIn: ["succeeded", "canceled"] } },
        data: { status: "canceled", canceledAt: now, finishedAt: now },
      });
      if (cas.count === 0) return { won: false } as const;
      await tx.releaseStage.updateMany({
        where: {
          releasePlanId: planId,
          status: { in: ["pending", "blocked", "awaiting_approval", "ready", "queued", "running"] },
        },
        data: { status: "canceled" },
      });
      await tx.releaseStageAttempt.updateMany({
        where: {
          releaseStage: { releasePlanId: planId },
          status: { in: ["queued", "running"] },
        },
        data: { status: "canceled", finishedAt: now, leaseOwner: null, leaseExpiresAt: null },
      });
      await tx.releaseConcurrencyLease.deleteMany({
        where: { releaseStage: { releasePlanId: planId } },
      });
      await tx.releaseEvent.create({
        data: {
          releasePlanId: planId,
          teamId,
          eventType: RELEASE_AUDIT_ACTIONS.plan_canceled,
          actorId,
          summary: "发布计划已取消",
        },
      });
      return { won: true } as const;
    });
    if (!outcome.won) {
      // CAS 失败：plan 已被并发 finalize/cancel 推进到终态。不抛 409（幂等语义），
      // 因为目标状态（已不可继续推进）已达成；调用方读最新 plan 即可看到真实终态。
      // 关键不变量：未产生部分取消，未写虚假 plan_canceled 事件。
      this.logger.warn(
        `cancel CAS lost on plan ${planId}: plan already terminal (status race with finalize/cancel)`,
      );
    }
  }

  // 取消单个 attempt 关联的真实外部作业：SEJ 直接取消；
  // 仅有 DeploymentRun 时查其底层 SEJ 再取消（每个 DR 都有底层 SEJ — D4）。
  // 终态作业会抛 BadRequestException，吞掉；其余异常仅 warn，不阻断取消流程。
  private async cancelAttemptExternalJob(
    teamId: string,
    actorId: string,
    attempt: {
      serverExecutionJobId: string | null;
      deploymentRunId: string | null;
    },
  ): Promise<void> {
    let jobId = attempt.serverExecutionJobId;
    if (!jobId && attempt.deploymentRunId) {
      const dr = await this.prisma.deploymentRun.findUnique({
        where: { id: attempt.deploymentRunId },
        select: { serverExecutionJobId: true },
      });
      jobId = dr?.serverExecutionJobId ?? null;
    }
    if (!jobId) return;
    try {
      await this.serverExecutor.cancelJob(teamId, actorId, jobId);
    } catch (err) {
      if (err instanceof BadRequestException) return; // 作业已终态，幂等吞掉
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`cancel SEJ ${jobId}: ${msg}`);
    }
  }
}
