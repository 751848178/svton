/**
 * 发布协调器：选择 ready 阶段、原子认领、调用适配器、同步关联运行状态、推进计划。
 * 不直接执行 shell，不复制 SSH/Agent。
 *
 * 关键不变式：
 * 1. 一个阶段同时只能有一个 active attempt（DB 唯一键 + 条件 updateMany）。
 * 2. 过期租约不直接标成功，必须从关联 DeploymentRun/ServerExecutionJob 回读终态。
 * 3. 成功阶段不重复执行（idempotencyKey + 终态短路）。
 *
 * 抽离的单一职责（均 <200 行）：
 *  - 终态收尾 → release-coordinator-terminal.service.ts
 *  - 适配器执行/路由 → release-coordinator-execution.service.ts
 *  - terminal 解释/审批守卫/状态重算/租约释放 → release-coordinator-helpers.utils.ts
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleaseStageAttemptRepository } from "./repository/release-stage-attempt.repository";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseStageClaimService } from "./release-stage-claim.service";
import { ReleaseReadinessService, type ReadinessStageView } from "./release-readiness.service";
import {
  ReleaseApprovalLifecycleService,
  type LifecyclePlanView,
  type LifecycleStageView,
} from "./release-approval-lifecycle.service";
import { ReleaseRecoveryService } from "./release-recovery.service";
import { ReleaseCoordinatorTerminalService } from "./release-coordinator-terminal.service";
import { ReleaseCoordinatorExecutionService } from "./release-coordinator-execution.service";
import { ServerCommandStageAdapter } from "./stage-adapters/server-command.adapter";
import { DeploymentRunStageAdapter } from "./stage-adapters/deployment-run.adapter";
import { HealthCheckStageAdapter } from "./stage-adapters/health-check.adapter";
import { ManualGateStageAdapter } from "./stage-adapters/manual-gate.adapter";
import {
  interpretTerminalNow,
  recomputePlanStatusNow,
  usableApprovalIdNow,
} from "./release-coordinator-helpers.utils";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionResult,
} from "./stage-adapters/release-stage-adapter.types";
import type { AttemptLinkedView } from "./release-recovery.service";
import type {
  ReleaseCoordinatorPort,
  ReleaseCoordinatorTerminal,
} from "./release-coordinator.port";

const ATTEMPT_TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled", "skipped"]);

@Injectable()
export class ReleaseCoordinatorService implements ReleaseCoordinatorPort {
  private readonly logger = new Logger(ReleaseCoordinatorService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stageRepo: ReleaseStageRepository,
    private readonly attemptRepo: ReleaseStageAttemptRepository,
    private readonly planRepo: ReleasePlanRepository,
    private readonly claimService: ReleaseStageClaimService,
    private readonly readiness: ReleaseReadinessService,
    private readonly recovery: ReleaseRecoveryService,
    private readonly approvalLifecycle: ReleaseApprovalLifecycleService,
    private readonly terminal: ReleaseCoordinatorTerminalService,
    private readonly execution: ReleaseCoordinatorExecutionService,
    // 适配器由 execution service 持有；此处保留注入引用以满足 Nest DI 树并便于未来扩展。
    private readonly serverCommandAdapter: ServerCommandStageAdapter,
    private readonly deploymentRunAdapter: DeploymentRunStageAdapter,
    private readonly healthCheckAdapter: HealthCheckStageAdapter,
    private readonly manualGateAdapter: ManualGateStageAdapter,
  ) {}

  // 推进整个计划：把 ready 阶段排队、收尾已完成 attempt、重算阶段/计划状态。幂等。
  async advancePlan(releasePlanId: string, actorId?: string): Promise<void> {
    const plan = await this.planRepo.findById(releasePlanId);
    if (!plan) return;
    if (["succeeded", "failed", "canceled"].includes(plan.status)) return;
    await this.recoverStaleAttempts(plan.id, plan.teamId);
    const lifecyclePlan: LifecyclePlanView = {
      id: plan.id, teamId: plan.teamId, projectId: plan.projectId,
      environmentId: plan.environmentId, name: plan.name,
      createdByUserId: plan.createdByUserId ?? null,
    };
    for (const stage of plan.stages) {
      const view = stage as ReadinessStageView;
      const fresh = await this.stageRepo.findById(stage.id);
      const freshStatus = (fresh?.status ?? stage.status) as string;
      if (["succeeded", "skipped", "canceled"].includes(freshStatus)) continue;
      if (fresh?.attempts?.some((a) => a.status === "succeeded")) continue;
      const ensured = await this.approvalLifecycle.ensureStageApproval(
        view as LifecycleStageView, lifecyclePlan,
      );
      view.stageApproval = ensured.approval;
      if (ensured.blocked) continue;
      const approvalId = usableApprovalIdNow(ensured.approval, view);
      await this.tryClaimAndStart(view, plan.teamId, actorId, approvalId);
    }
    await recomputePlanStatusNow({ stageRepo: this.stageRepo, planRepo: this.planRepo }, plan.id);
  }

  // SEJ/DeploymentRun 完成回调入口（RELEASE_COORDINATOR_PORT）。幂等；异常只 warn（P0-2）。
  async finalizeAndAdvance(
    releasePlanId: string,
    stageAttemptId: string,
    terminal: ReleaseCoordinatorTerminal,
  ): Promise<void> {
    try {
      const attempt = await this.attemptRepo.findById(stageAttemptId);
      if (!attempt) return;
      if (ATTEMPT_TERMINAL_STATUSES.has(attempt.status)) return;
      const stage = await this.stageRepo.findById(attempt.releaseStageId);
      if (!stage) return;
      await this.terminal.finishAttempt(
        stage as ReadinessStageView,
        attempt as AttemptLinkedView,
        interpretTerminalNow(terminal),
        stage.teamId,
      );
      await this.advancePlan(releasePlanId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`finalizeAndAdvance failed for attempt ${stageAttemptId}: ${msg}`);
    }
  }

  // 尝试认领并启动一个阶段；幂等。原子认领委托 ReleaseStageClaimService（事务内完成）。
  private async tryClaimAndStart(
    stage: ReadinessStageView,
    teamId: string,
    actorId?: string,
    approvalId?: string | null,
  ): Promise<void> {
    const facts = await this.readiness.assembleFacts(stage);
    const result = this.readiness.compute({ ...facts, releaseExecutable: true });
    if (!result.ready) return;
    const outcome = await this.claimService.claimAtomically({
      stageId: stage.id, teamId, actorId: actorId ?? null, approvalId: approvalId ?? null,
    });
    if (outcome.kind !== "won") {
      if (outcome.kind === "concurrency-busy") {
        await this.stageRepo.updateStatusIf(stage.id, ["ready"], {
          status: "blocked", blockedReason: "等待并发键释放",
        }).catch(() => undefined);
      }
      return;
    }
    const attempt = await this.attemptRepo.findById(outcome.attemptId);
    if (!attempt) return;
    await this.execution.startAttempt(stage, attempt, teamId, actorId);
  }

  // 终态收尾转发（维持 public 入口，供恢复链路与测试调用）。
  async finishAttempt(
    stage: ReadinessStageView,
    attempt: AttemptLinkedView,
    result: ReleaseStageExecutionResult,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
    await this.terminal.finishAttempt(stage, attempt, result, teamId, actorId);
  }

  // 适配器路由转发（供测试断言）。
  selectAdapter(stage: { type: string; executorKind: string }): ReleaseStageAdapter {
    return this.execution.selectAdapter(stage);
  }

  // 回收过期租约：委托 ReleaseRecoveryService 从关联运行回读终态后收尾。
  async recoverStaleAttempts(releasePlanId: string, teamId: string): Promise<void> {
    await this.recovery.scanAndRecover(releasePlanId, async (stage, attempt, result) => {
      await this.terminal.finishAttempt(stage, attempt, result, teamId);
    });
  }
}
