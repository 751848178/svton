/**
 * 发布协调器：选择 ready 阶段、原子认领、调用适配器、同步关联运行状态、
 * 推进计划。不直接执行 shell，不复制 SSH/Agent。
 *
 * 关键不变式：
 * 1. 一个阶段同时只能有一个 active attempt（DB 唯一键 + 条件 updateMany）。
 * 2. 过期租约不直接标成功，必须从关联 DeploymentRun/ServerExecutionJob 回读终态。
 * 3. 成功阶段不重复执行（idempotencyKey + 终态短路）。
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import {
  ReleaseStageAttemptRepository,
} from "./repository/release-stage-attempt.repository";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ReleaseReadinessService, type ReadinessStageView } from "./release-readiness.service";
import { ReleaseRecoveryService, type AttemptLinkedView } from "./release-recovery.service";
import { ServerCommandStageAdapter } from "./stage-adapters/server-command.adapter";
import { DeploymentRunStageAdapter } from "./stage-adapters/deployment-run.adapter";
import { ManualGateStageAdapter } from "./stage-adapters/manual-gate.adapter";
import { sanitizeOutputForPersistence } from "./utils/release-output.utils";
import { redactSecretsInText } from "./utils/release-redact.utils";
import {
  assertLegalStageTransition,
  derivePlanStatusFromStages,
} from "./utils/release-state-machine.utils";
import { RELEASE_AUDIT_ACTIONS } from "./types/release-orchestration.types";
import type { ReleaseStageExecutionContext, ReleaseStageExecutionResult } from "./stage-adapters/release-stage-adapter.types";
import type { ReleaseStageStatus } from "./types/release-orchestration.types";

const LEASE_MS = 15 * 60 * 1000;

@Injectable()
export class ReleaseCoordinatorService {
  private readonly logger = new Logger(ReleaseCoordinatorService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stageRepo: ReleaseStageRepository,
    private readonly attemptRepo: ReleaseStageAttemptRepository,
    private readonly planRepo: ReleasePlanRepository,
    private readonly eventRepo: ReleaseEventRepository,
    private readonly readiness: ReleaseReadinessService,
    private readonly recovery: ReleaseRecoveryService,
    private readonly serverCommandAdapter: ServerCommandStageAdapter,
    private readonly deploymentRunAdapter: DeploymentRunStageAdapter,
    private readonly manualGateAdapter: ManualGateStageAdapter,
  ) {}

  // 推进整个计划：把 ready 阶段排队、把已完成的 attempt 收尾、重算阶段/计划状态。
  // 可重复调用（幂等），由 API、定时器、恢复链路触发。
  async advancePlan(releasePlanId: string, actorId?: string): Promise<void> {
    const plan = await this.planRepo.findById(releasePlanId);
    if (!plan) return;
    if (["succeeded", "failed", "canceled"].includes(plan.status)) return;

    // 1. 先回收过期租约并回读关联运行终态
    await this.recoverStaleAttempts(plan.id, plan.teamId);

    // 2. 对每个非终态阶段重算 readiness，认领 ready 阶段
    for (const stage of plan.stages) {
      if (["succeeded", "skipped", "canceled"].includes(stage.status)) continue;
      await this.tryClaimAndStart(stage as ReadinessStageView, plan.teamId, actorId);
    }

    // 3. 重新派生计划状态
    await this.recomputePlanStatus(plan.id);
  }

  // 尝试认领并启动一个阶段；幂等。
  private async tryClaimAndStart(
    stage: ReadinessStageView,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
    const facts = await this.readiness.assembleFacts(stage);
    const result = this.readiness.compute({ ...facts, releaseExecutable: true });
    if (!result.ready) return;

    // 已有 active attempt 则不重复认领
    const active = await this.attemptRepo.findActiveByStage(stage.id);
    if (active) return;

    const attemptNo = stage.currentAttempt + 1;
    const attempt = await this.attemptRepo.create({
      releaseStage: { connect: { id: stage.id } },
      team: { connect: { id: teamId } },
      attemptNo,
      status: "queued",
      inputSnapshot: { configHash: stage.configHash } as never,
    });
    await this.stageRepo.updateStatusIf(
      stage.id,
      ["ready", "failed", "blocked"],
      { status: "queued", blockedReason: null, currentAttempt: attemptNo },
    );
    await this.eventRepo.append({
      releasePlanId: stage.releasePlanId,
      releaseStageId: stage.id,
      stageAttemptId: attempt.id,
      teamId,
      eventType: RELEASE_AUDIT_ACTIONS.stage_claimed,
      actorId: actorId ?? null,
      summary: `阶段 ${stage.key} 排队（attempt ${attemptNo}）`,
    });

    await this.startAttempt(stage, attempt, teamId, actorId);
  }

  // 认领 attempt 并调用适配器
  private async startAttempt(
    stage: ReadinessStageView,
    attempt: AttemptLinkedView,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
    const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
    const owner = `release-coordinator:${process.pid}:${attempt.id}`;
    const claimed = await this.attemptRepo.claim(attempt.id, owner, leaseExpiresAt);
    if (claimed === 0) {
      // 已被他人认领或已终态
      return;
    }
    await this.stageRepo.updateStatusIf(stage.id, ["queued"], {
      status: "running",
      blockedReason: null,
      currentAttempt: attempt.attemptNo,
    });

    const ctx: ReleaseStageExecutionContext = {
      releasePlanId: stage.releasePlanId,
      releaseStageId: stage.id,
      attemptId: attempt.id,
      teamId,
      projectId: stage.releasePlan.projectId,
      environmentId: stage.releasePlan.environmentId,
      applicationId: stage.applicationId,
      applicationServiceId: stage.applicationServiceId,
      serverId: stage.serverId ?? null,
      configSnapshot: enrichConfig(stage),
      configHash: stage.configHash ?? null,
      actorId: actorId ?? null,
      operationApprovalId: attempt.operationApprovalId ?? null,
    };

    const adapter = this.selectAdapter(stage.executorKind);
    try {
      const result = await adapter.execute(ctx);
      await this.handleAdapterResult(stage, attempt, result, teamId, actorId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.finishAttempt(stage, attempt, {
        status: "failed",
        error: redactSecretsInText(msg),
      }, teamId, actorId);
    }
  }

  private selectAdapter(executorKind: string) {
    switch (executorKind) {
      case "deployment_run":
        return this.deploymentRunAdapter;
      case "manual_gate":
        return this.manualGateAdapter;
      case "server_command":
      case "shell":
      default:
        return this.serverCommandAdapter;
    }
  }

  // 适配器返回 queued 时只回填关联运行 id；终态由恢复链路回读
  private async handleAdapterResult(
    stage: ReadinessStageView,
    attempt: AttemptLinkedView,
    result: ReleaseStageExecutionResult,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
    if (result.serverExecutionJobId || result.deploymentRunId || result.operationApprovalId) {
      await this.attemptRepo.linkRun(attempt.id, {
        deploymentRunId: result.deploymentRunId ?? null,
        serverExecutionJobId: result.serverExecutionJobId ?? null,
        operationApprovalId: result.operationApprovalId ?? null,
      });
    }
    if (result.status === "succeeded" || result.status === "failed" || result.status === "skipped") {
      await this.finishAttempt(stage, attempt, result, teamId, actorId);
    }
    // queued：保持 running，等待恢复链路回读
  }

  // 写入 attempt 终态 + 阶段状态转换 + 事件
  async finishAttempt(
    stage: ReadinessStageView,
    attempt: AttemptLinkedView,
    result: ReleaseStageExecutionResult,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
    const updated = await this.attemptRepo.finish(attempt.id, {
      status: result.status,
      output: sanitizeOutputForPersistence(result.output ?? null) as never,
      logSummary: result.logSummary as never,
      error: result.error ? redactSecretsInText(result.error) : null,
      finishedAt: new Date(),
    });
    if (updated === 0) return; // 已被他人收尾

    const nextStageStatus: ReleaseStageStatus =
      result.status === "succeeded"
        ? "succeeded"
        : result.status === "skipped"
          ? "skipped"
          : "failed";
    assertLegalStageTransition(stage.status as ReleaseStageStatus, nextStageStatus);
    await this.stageRepo.update(stage.id, {
      status: nextStageStatus,
      blockedReason: result.status === "failed" ? result.error ?? null : null,
    });
    await this.eventRepo.append({
      releasePlanId: stage.releasePlanId,
      releaseStageId: stage.id,
      stageAttemptId: attempt.id,
      teamId,
      eventType: RELEASE_AUDIT_ACTIONS.stage_finished,
      actorId: actorId ?? null,
      summary: `阶段 ${stage.key} ${result.status}`,
      metadata: { status: result.status },
    });
  }

  // 回收过期租约：委托 ReleaseRecoveryService 从关联运行回读终态后收尾
  async recoverStaleAttempts(releasePlanId: string, teamId: string): Promise<void> {
    await this.recovery.scanAndRecover(releasePlanId, async (stage, attempt, result) => {
      await this.finishAttempt(stage, attempt, result, teamId);
    });
  }

  // 重算计划状态（基于全部阶段状态）
  private async recomputePlanStatus(releasePlanId: string): Promise<void> {
    const stages = await this.stageRepo.listByPlan(releasePlanId);
    const derived = derivePlanStatusFromStages(
      stages.map((s) => s.status as ReleaseStageStatus),
    );
    const plan = await this.planRepo.findById(releasePlanId);
    if (!plan) return;
    if (["succeeded", "failed", "canceled"].includes(plan.status)) return;
    const patch: { status: string; blockedReason?: string | null; startedAt?: Date; finishedAt?: Date } = {
      status: derived.status,
    };
    if (derived.blockedReason !== undefined) patch.blockedReason = derived.blockedReason;
    if (derived.status === "running" && !plan.startedAt) patch.startedAt = new Date();
    if (["succeeded", "failed", "canceled"].includes(derived.status) && !plan.finishedAt) {
      patch.finishedAt = new Date();
    }
    await this.planRepo.update(releasePlanId, patch);
  }
}

// 阶段配置补充：把 stageType/stageName 注入 configSnapshot，供 adapter 路由
function enrichConfig(stage: ReadinessStageView): Record<string, unknown> {
  const base = (stage.configSnapshot ?? {}) as Record<string, unknown>;
  return {
    ...base,
    __stageType: stage.type,
    __stageName: stage.name,
  };
}
