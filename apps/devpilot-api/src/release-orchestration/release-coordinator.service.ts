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
import { ReleaseConcurrencyLeaseRepository } from "./repository/release-concurrency-lease.repository";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ReleaseStageClaimService } from "./release-stage-claim.service";
import { ReleaseReadinessService, type ReadinessStageView } from "./release-readiness.service";
import {
  ReleaseApprovalLifecycleService,
  type EnsureApprovalResult,
  type LifecyclePlanView,
  type LifecycleStageView,
} from "./release-approval-lifecycle.service";
import { ReleaseRecoveryService, type AttemptLinkedView } from "./release-recovery.service";
import { ServerCommandStageAdapter } from "./stage-adapters/server-command.adapter";
import { DeploymentRunStageAdapter } from "./stage-adapters/deployment-run.adapter";
import { HealthCheckStageAdapter } from "./stage-adapters/health-check.adapter";
import { ManualGateStageAdapter } from "./stage-adapters/manual-gate.adapter";
import {
  interpretServerCommandResult,
  interpretDeploymentRunResult,
} from "./stage-adapters/release-adapter-interpret.utils";
import { sanitizeOutputForPersistence } from "./utils/release-output.utils";
import { redactSecretsInObject, redactSecretsInText } from "./utils/release-redact.utils";
import { expectedStageInputHash } from "./utils/release-approval-predicate.utils";
import {
  derivePlanStatusFromStages,
} from "./utils/release-state-machine.utils";
import { RELEASE_AUDIT_ACTIONS } from "./types/release-orchestration.types";
import type { ReleaseStageExecutionContext, ReleaseStageExecutionResult } from "./stage-adapters/release-stage-adapter.types";
import type { ReleaseStageStatus } from "./types/release-orchestration.types";
import type {
  ReleaseCoordinatorPort,
  ReleaseCoordinatorTerminal,
} from "./release-coordinator.port";

const ATTEMPT_TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled", "skipped"]);

const LEASE_MS = 15 * 60 * 1000;

@Injectable()
export class ReleaseCoordinatorService implements ReleaseCoordinatorPort {
  private readonly logger = new Logger(ReleaseCoordinatorService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stageRepo: ReleaseStageRepository,
    private readonly attemptRepo: ReleaseStageAttemptRepository,
    private readonly leaseRepo: ReleaseConcurrencyLeaseRepository,
    private readonly planRepo: ReleasePlanRepository,
    private readonly eventRepo: ReleaseEventRepository,
    private readonly claimService: ReleaseStageClaimService,
    private readonly readiness: ReleaseReadinessService,
    private readonly recovery: ReleaseRecoveryService,
    private readonly approvalLifecycle: ReleaseApprovalLifecycleService,
    private readonly serverCommandAdapter: ServerCommandStageAdapter,
    private readonly deploymentRunAdapter: DeploymentRunStageAdapter,
    private readonly healthCheckAdapter: HealthCheckStageAdapter,
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

    const lifecyclePlan: LifecyclePlanView = {
      id: plan.id,
      teamId: plan.teamId,
      projectId: plan.projectId,
      environmentId: plan.environmentId,
      name: plan.name,
      createdByUserId: plan.createdByUserId ?? null,
    };

    // 2. 对每个非终态阶段：先确保阶段绑定审批存在，再重算 readiness 并认领
    // 注意：plan.stages 是 advancePlan 入口处读取的快照；recoverStaleAttempts 可能在
    // 循环前把某阶段收尾为 succeeded（stage.status 视图已陈旧）。每个阶段处理前
    // 重读当前状态：若已转终态（被恢复链路或并发取消终态化），跳过 ensureStageApproval，
    // 避免对已消费审批再 mint 第二个 pending / 对已终态阶段重复认领。
    for (const stage of plan.stages) {
      const view = stage as ReadinessStageView;
      const fresh = await this.stageRepo.findById(stage.id);
      const freshStatus = (fresh?.status ?? stage.status) as string;
      if (["succeeded", "skipped", "canceled"].includes(freshStatus)) continue;
      if (fresh?.attempts?.some((a) => a.status === "succeeded")) continue;
      const ensured = await this.approvalLifecycle.ensureStageApproval(
        view as LifecycleStageView,
        lifecyclePlan,
      );
      view.stageApproval = ensured.approval;
      if (ensured.blocked) continue; // 审批被拒绝 → 已置 blocked，跳过认领
      const approvalId = this.usableApprovalId(ensured.approval, view);
      await this.tryClaimAndStart(view, plan.teamId, actorId, approvalId);
    }

    // 3. 重新派生计划状态
    await this.recomputePlanStatus(plan.id);
  }

  // SEJ/DeploymentRun 完成回调入口（RELEASE_COORDINATOR_PORT）。幂等：
  // 重新读 attempt → 已终态直接返回 → 解释 terminal → finishAttempt + advancePlan。
  // 任何异常只记 warn，绝不向 SEJ 完成路径抛错（P0-2）。
  async finalizeAndAdvance(
    releasePlanId: string,
    stageAttemptId: string,
    terminal: ReleaseCoordinatorTerminal,
  ): Promise<void> {
    try {
      const attempt = await this.attemptRepo.findById(stageAttemptId);
      if (!attempt) return;
      if (ATTEMPT_TERMINAL_STATUSES.has(attempt.status)) return; // 幂等：重复完成回调

      const stage = await this.stageRepo.findById(attempt.releaseStageId);
      if (!stage) return;
      const interpreted = this.interpretTerminal(terminal);
      const teamId = stage.teamId;
      await this.finishAttempt(
        stage as ReadinessStageView,
        attempt as AttemptLinkedView,
        interpreted,
        teamId,
      );
      await this.advancePlan(releasePlanId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `finalizeAndAdvance failed for attempt ${stageAttemptId}: ${msg}`,
      );
    }
  }

  // terminal.result 形状镜像 ServerExecutionJob/DeploymentRun 终态；沿用现有解释器
  private interpretTerminal(
    terminal: ReleaseCoordinatorTerminal,
  ): ReleaseStageExecutionResult {
    return terminal.kind === "deploymentRun"
      ? interpretDeploymentRunResult(terminal.result)
      : interpretServerCommandResult(terminal.result);
  }

  // 仅当审批处于 approved 且未消费时才绑定到 attempt（pending 不绑定，避免误消费）
  // CR-2-P2：额外断言 approval.inputHash === 当前阶段期望 configHash 派生值；
  // 不匹配（配置变更后旧 approved 审批）→ 返回 null，留待 ensureStageApproval 重建。
  private usableApprovalId(
    approval: EnsureApprovalResult["approval"],
    stage: ReadinessStageView,
  ): string | null {
    if (!approval || approval.status !== "approved" || approval.consumedAt) {
      return null;
    }
    const expected = expectedStageInputHash({
      releasePlanId: stage.releasePlanId,
      key: stage.key,
      environmentId: stage.environmentId ?? stage.releasePlan.environmentId,
      configHash: stage.configHash,
    });
    if ((approval.inputHash ?? "") !== expected) {
      return null;
    }
    return approval.id ?? null;
  }

  // 尝试认领并启动一个阶段；幂等。原子认领委托 ReleaseStageClaimService：
  // 读阶段→幂等/活跃检查→并发租约→CAS→创建 attempt→事件 全在一个 $transaction。
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
      stageId: stage.id,
      teamId,
      actorId: actorId ?? null,
      approvalId: approvalId ?? null,
    });
    // 未赢得认领：不创建任何作业/事件，杜绝孤儿（P0-1/P1-4）
    if (outcome.kind !== "won") {
      if (outcome.kind === "concurrency-busy") {
        await this.stageRepo.updateStatusIf(stage.id, ["ready"], {
          status: "blocked",
          blockedReason: "等待并发键释放",
        }).catch(() => undefined);
      }
      return;
    }
    const attempt = await this.attemptRepo.findById(outcome.attemptId);
    if (!attempt) return;
    await this.startAttempt(stage, attempt, teamId, actorId);
  }

  // 认领 attempt 并调用适配器。
  // 注意：原子 claim（claimAtomically）已在事务内把 attempt 置 queued 并写租约；
  // 这里只需把阶段 queued→running 并执行 adapter，不再重复 claim。
  private async startAttempt(
    stage: ReadinessStageView,
    attempt: AttemptLinkedView,
    teamId: string,
    actorId?: string,
  ): Promise<void> {
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

    const adapter = this.selectAdapter(stage);
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

  // 类型优先路由（D7）：health_check 必须走 HealthCheckStageAdapter（构造 sanitized
  // curl），不能落到 ServerCommandStageAdapter 把 URL 当 shell 命令执行。
  private selectAdapter(stage: { type: string; executorKind: string }) {
    if (stage.type === "health_check") return this.healthCheckAdapter;
    switch (stage.executorKind) {
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
      // 仅回填适配器实际返回的关联 id；未返回的字段不传，避免覆盖 claim 阶段已绑定的
      // operationApprovalId（server_command 适配器返回 serverExecutionJobId 但无 approvalId，
      // 旧实现用 null 覆盖 → 审批消费链路断裂）。
      const linkData: {
        deploymentRunId?: string | null;
        serverExecutionJobId?: string | null;
        operationApprovalId?: string | null;
      } = {};
      if (result.deploymentRunId !== undefined) linkData.deploymentRunId = result.deploymentRunId;
      if (result.serverExecutionJobId !== undefined) linkData.serverExecutionJobId = result.serverExecutionJobId;
      if (result.operationApprovalId !== undefined) linkData.operationApprovalId = result.operationApprovalId;
      await this.attemptRepo.linkRun(attempt.id, linkData);
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
      // D10：logSummary 在 finishAttempt 单一 choke point 脱敏（适配器返回原始领域形状，
      // coordinator 统一清洗）。Slice 1 的 Date guard 保证 logSummary 内的 Date 字段
      // 被归一为 ISO 字符串而非破坏成 {}。
      logSummary: redactSecretsInObject(result.logSummary ?? null) as never,
      error: result.error ? redactSecretsInText(result.error) : null,
      finishedAt: new Date(),
    });
    if (updated === 0) return; // 已被他人收尾

    // 终态收尾时释放并发租约（事务外尽力而为；过期租约也会被 acquire 清扫）
    // CR-1-F8：按 owner 范围删除（attempt.leaseOwner），避免误删同一 concurrencyKey
    // 上其他 owner（时钟漂移下）持有的有效租约。
    if (stage.concurrencyKey) {
      const leaseOwner = (attempt as { leaseOwner?: string | null }).leaseOwner ?? null;
      await this.releaseLeaseOutsideTx(stage.concurrencyKey, leaseOwner).catch(() => undefined);
    }

    // 成功收尾：消费阶段绑定审批（失败不阻塞 finish）
    if (result.status === "succeeded" && attempt.operationApprovalId) {
      await this.approvalLifecycle.consume(teamId, attempt.operationApprovalId);
    }

    const nextStageStatus: ReleaseStageStatus =
      result.status === "succeeded"
        ? "succeeded"
        : result.status === "skipped"
          ? "skipped"
          : "failed";
    // CR-1-F2 根因修复：stage 终态转换改为 CAS。旧实现先 updateStatusIf 强翻 running，
    // 再 assertLegalStageTransition + 无条件 update——一旦并发 cancel 已把 stage → canceled，
    // assert 抛错并被 finalizeAndAdvance 的 catch 吞掉 → attempt=succeeded / stage=canceled 不一致。
    //
    // 两步 CAS（谓词本身就是合法性检查，无需 assert）：
    // 1. 把 pre-running 非终态（pending/queued/blocked/awaiting_approval）best-effort 翻到 running。
    //    覆盖恢复链路：pending/queued 状态下 SEJ 已完成的 attempt 也需收尾。
    // 2. CAS running→terminal。count===0 表示 stage 已被并发终态化（cancel/skip）→ 直接返回，不写事件。
    await this.stageRepo.updateStatusIf(
      stage.id,
      ["pending", "queued", "blocked", "awaiting_approval"],
      { status: "running", blockedReason: null },
    );
    const transition = await this.stageRepo.updateStatusIf(stage.id, ["running"], {
      status: nextStageStatus,
      blockedReason: result.status === "failed" ? result.error ?? null : null,
    });
    if (transition === 0) return;
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

  // 终态收尾后释放并发租约（事务外尽力而为；过期租约也会被 acquire 清扫）
  // CR-1-F8：按 owner 范围删除——仅释放当前 attempt.leaseOwner 持有的行，
  // 避免误删同一 concurrencyKey 上其他 owner（时钟漂移场景）的有效租约。
  private async releaseLeaseOutsideTx(concurrencyKey: string, owner: string | null): Promise<void> {
    await this.prisma.releaseConcurrencyLease.deleteMany({
      where: owner ? { concurrencyKey, owner } : { concurrencyKey },
    });
  }

  // 重算计划状态（基于全部阶段状态）
  // CR-1-F3 根因修复：状态转换改为 CAS（updateStatusIf），排除 succeeded/canceled 终态，
  // 避免非原子 read-modify-write 在并发 advancePlan 下 last-writer-wins 丢失更新。
  // failed 保留在谓词内，使 retry 重开（failed→running）后 recompute 仍能更新。
  private async recomputePlanStatus(releasePlanId: string): Promise<void> {
    const stages = await this.stageRepo.listByPlan(releasePlanId);
    const derived = derivePlanStatusFromStages(
      stages.map((s) => s.status as ReleaseStageStatus),
    );
    const plan = await this.planRepo.findById(releasePlanId);
    if (!plan) return;
    if (["succeeded", "canceled"].includes(plan.status)) return;
    const patch: { status: string; blockedReason?: string | null; startedAt?: Date; finishedAt?: Date } = {
      status: derived.status,
    };
    if (derived.blockedReason !== undefined) patch.blockedReason = derived.blockedReason;
    if (derived.status === "running" && !plan.startedAt) patch.startedAt = new Date();
    if (["succeeded", "failed", "canceled"].includes(derived.status) && !plan.finishedAt) {
      patch.finishedAt = new Date();
    }
    await this.planRepo.updateStatusIf(
      releasePlanId,
      ["draft", "awaiting_approval", "ready", "running", "blocked", "failed"],
      patch,
    );
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
