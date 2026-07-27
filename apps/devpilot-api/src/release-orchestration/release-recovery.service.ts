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
      if (!["running", "queued"].includes(stage.status)) continue;
      const attempt = stage.attempts[0];
      if (!attempt) continue;
      const expired =
        attempt.status === "running" &&
        attempt.leaseExpiresAt &&
        attempt.leaseExpiresAt < now;
      if (!expired && attempt.status !== "queued") continue;
      const result = await this.readLinkedRunTerminal(attempt);
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
