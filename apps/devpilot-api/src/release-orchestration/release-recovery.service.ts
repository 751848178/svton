/**
 * 发布恢复服务：回收过期租约，从关联 DeploymentRun/ServerExecutionJob 回读终态。
 * 过期尝试不得直接标成功，必须回读关联运行。
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import {
  interpretServerCommandResult,
  interpretDeploymentRunResult,
} from "./stage-adapters/release-adapter-interpret.utils";
import type { ReleaseStageExecutionResult } from "./stage-adapters/release-stage-adapter.types";
import type { ReadinessStageView } from "./release-readiness.service";

// 结构化 attempt 视图：兼容 plan repo 嵌套 attempt 与 attempt repo detail
export interface AttemptLinkedView {
  id: string;
  attemptNo: number;
  status: string;
  operationApprovalId?: string | null;
  deploymentRunId?: string | null;
  serverExecutionJobId?: string | null;
  leaseExpiresAt?: Date | null;
}

@Injectable()
export class ReleaseRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planRepo: ReleasePlanRepository,
  ) {}

  // 扫描计划内过期/排队中的 attempt，回读关联运行终态
  async scanAndRecover(
    releasePlanId: string,
    onFinish: (
      stage: ReadinessStageView,
      attempt: AttemptLinkedView,
      result: ReleaseStageExecutionResult,
    ) => Promise<void>,
  ): Promise<void> {
    const plan = await this.planRepo.findById(releasePlanId);
    if (!plan) return;
    const now = new Date();
    for (const stage of plan.stages) {
      // P0-1 修复：扫描覆盖 pending-with-active-attempt（孤儿 attempt + 活作业）。
      // 仅跳过阶段终态；非终态阶段若存在 active attempt，就回读关联运行终态。
      if (["succeeded", "skipped", "canceled"].includes(stage.status)) continue;
      const attempt = stage.attempts[0];
      if (!attempt) continue;
      const expired =
        attempt.status === "running" &&
        attempt.leaseExpiresAt &&
        attempt.leaseExpiresAt < now;
      if (!expired && attempt.status !== "queued") continue;
      // P1-5（invest-2 §E.2）：单阶段解析异常不得中断整个恢复扫描。
      // OutputParseError（哨兵解码失败等）被隔离成本阶段 failed，其它阶段继续。
      let result;
      try {
        result = await this.readLinkedRunTerminal(attempt);
      } catch (err) {
        result = {
          status: "failed" as const,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      // 过期孤儿 attempt：租约已过期且没有任何关联运行（SEJ/DeploymentRun）→ 不得静默挂起，
      // 标记 failed 并给出明确原因（不静默成功）。保留审计：onFinish 会写 attempt 终态 + 事件。
      if (!result && expired) {
        result = {
          status: "failed" as const,
          error: "发布阶段租约过期且无关联运行，判定为孤儿任务",
        };
      }
      if (!result || result.status === "queued") continue;
      await onFinish(stage as ReadinessStageView, attempt as AttemptLinkedView, result);
    }
  }

  // 从关联 DeploymentRun / ServerExecutionJob 回读真实终态
  private async readLinkedRunTerminal(
    attempt: { serverExecutionJobId?: string | null; deploymentRunId?: string | null },
  ): Promise<ReleaseStageExecutionResult | null> {
    if (attempt.serverExecutionJobId) {
      const job = await this.prisma.serverExecutionJob.findUnique({
        where: { id: attempt.serverExecutionJobId },
        select: { status: true, result: true, logs: true, error: true },
      });
      if (job && ["completed", "failed", "cancelled", "blocked"].includes(job.status)) {
        return interpretServerCommandResult(job);
      }
    }
    if (attempt.deploymentRunId) {
      const run = await this.prisma.deploymentRun.findUnique({
        where: { id: attempt.deploymentRunId },
        select: { status: true, result: true, logs: true, error: true },
      });
      if (run && ["completed", "failed", "cancelled", "blocked"].includes(run.status)) {
        return interpretDeploymentRunResult(run);
      }
    }
    return null;
  }
}
