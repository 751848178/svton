/**
 * 发布计划服务：预览、创建、执行、取消、重试、受控跳过。
 * dry-run 只解析校验显示副作用，不创建任务、不消费审批。
 * 正式创建冻结 inputSnapshot + planHash。
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorService } from "../server-executor/server-executor.service";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleaseStageAttemptRepository } from "./repository/release-stage-attempt.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ReleaseCoordinatorService } from "./release-coordinator.service";
import { ReleaseApprovalLifecycleService } from "./release-approval-lifecycle.service";
import {
  buildReleasePlan,
  type ReleasePlanBuildInput,
  type ReleasePlanPreview,
} from "./utils/release-plan-builder.utils";
import { redactSecretsInObject } from "./utils/release-redact.utils";
import { resolveGitRef } from "./utils/release-git-ref.utils";
import {
  assertLegalPlanTransition,
  assertLegalStageTransition,
} from "./utils/release-state-machine.utils";
import {
  RELEASE_AUDIT_ACTIONS,
  RELEASE_ORCHESTRATION_FLAG,
} from "./types/release-orchestration.types";

const SKIP_CONFIRMATION = "我确认跳过此可选阶段";

@Injectable()
export class ReleasePlanService {
  private readonly logger = new Logger(ReleasePlanService.name);
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly planRepo: ReleasePlanRepository,
    private readonly stageRepo: ReleaseStageRepository,
    private readonly attemptRepo: ReleaseStageAttemptRepository,
    private readonly eventRepo: ReleaseEventRepository,
    private readonly coordinator: ReleaseCoordinatorService,
    private readonly approvalLifecycle: ReleaseApprovalLifecycleService,
    private readonly serverExecutor: ServerExecutorService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>(RELEASE_ORCHESTRATION_FLAG) === "true";
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ForbiddenException("发布编排未启用（DEVPILOT_RELEASE_ORCHESTRATION_ENABLED）");
    }
  }

  // 预览：纯解析，不写 DB；提交前解析 git ref（branch → commitSha）。
  async preview(input: ReleasePlanBuildInput): Promise<ReleasePlanPreview> {
    await this.resolveGitRefInto(input);
    const result = buildReleasePlan(input);
    if (!result.ok) {
      throw new BadRequestException({
        code: "RELEASE_PLAN_INVALID",
        message: result.error.message,
        details: result.error.details,
      });
    }
    return redactSecretsInObject(result.value);
  }

  // 正式创建计划（冻结快照）
  async create(
    input: ReleasePlanBuildInput & {
      teamId: string;
      createdByUserId?: string;
      expectedPlanHash?: string;
    },
  ): Promise<{ id: string; planHash: string }> {
    this.assertEnabled();
    const preview = await this.preview(input);
    // preview ↔ create 强绑定（invest-3 §C）：客户端回传 expectedPlanHash，
    // 与本次重新计算的 preview.planHash 不一致即 409。
    // 暂时可选——若未提供仅记 deprecation 警告（向后兼容现有 fixture/UI）。
    if (input.expectedPlanHash !== undefined) {
      if (preview.planHash !== input.expectedPlanHash) {
        throw new ConflictException({
          code: "RELEASE_PLAN_STALE",
          message: "预览已过期，请重新生成",
          expected: preview.planHash,
          received: input.expectedPlanHash,
        });
      }
    } else {
      this.logger.warn(
        "create 未传 expectedPlanHash；后续 Slice 8b 将强制要求（invest-3 §C.2）",
      );
    }
    const plan = await this.planRepo.persistPlanWithStages({
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      name: input.name,
      branch: input.branch ?? null,
      commitSha: input.commitSha ?? null,
      planHash: preview.planHash,
      inputSnapshot: redactSecretsInObject(preview.inputSnapshot),
      createdByUserId: input.createdByUserId ?? null,
      stages: preview.stages.map((stage) => ({
        key: stage.key,
        name: stage.name,
        type: stage.type,
        executorKind: stage.executorKind,
        applicationId: stage.applicationId ?? null,
        applicationServiceId: stage.applicationServiceId ?? null,
        environmentId: stage.environmentId ?? null,
        serverId: stage.serverId ?? null,
        configSnapshot: redactSecretsInObject(stage.configSnapshot ?? {}),
        configHash: stage.configHash ?? null,
        concurrencyKey: stage.concurrencyKey ?? null,
        riskLevel: stage.riskLevel,
        required: stage.required,
      })),
      dependencies: preview.dependencies,
    });
    await this.eventRepo.append({
      releasePlanId: plan.id,
      teamId: input.teamId,
      eventType: RELEASE_AUDIT_ACTIONS.plan_created,
      actorId: input.createdByUserId ?? null,
      summary: `创建发布计划 ${input.name}`,
      metadata: { planHash: preview.planHash },
    });
    return { id: plan.id, planHash: preview.planHash };
  }

  async get(teamId: string, planId: string) {
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.teamId !== teamId) {
      throw new NotFoundException("发布计划不存在");
    }
    return redactSecretsInObject(plan);
  }

  async list(teamId: string, query: { projectId?: string; environmentId?: string; status?: string }) {
    const plans = await this.planRepo.list({ teamId, ...query });
    return redactSecretsInObject(plans);
  }

  async execute(teamId: string, planId: string, actorId: string): Promise<void> {
    this.assertEnabled();
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.teamId !== teamId) throw new NotFoundException("发布计划不存在");
    const updated = await this.planRepo.updateStatusIf(
      planId,
      ["ready", "blocked"],
      { status: "running", startedAt: new Date(), blockedReason: null },
    );
    if (updated === 0) {
      throw new ConflictException(`计划当前状态 ${plan.status} 不可执行`);
    }
    await this.eventRepo.append({
      releasePlanId: planId,
      teamId,
      eventType: RELEASE_AUDIT_ACTIONS.plan_executed,
      actorId,
      summary: "开始执行发布计划",
    });
    await this.coordinator.advancePlan(planId, actorId);
  }

  // 取消发布计划：先尽力取消真实外部作业（SEJ/DeploymentRun 底层 SEJ），
  // 再用单个事务把 plan/stage/attempt → canceled、释放并发租约、追加事件，
  // 保证不出现部分取消的中间态（P0-8）。
  async cancel(teamId: string, planId: string, actorId: string): Promise<void> {
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.teamId !== teamId) throw new NotFoundException("发布计划不存在");
    if ((["succeeded", "canceled"] as string[]).includes(plan.status)) {
      throw new ConflictException("计划已终态，不可取消");
    }
    assertLegalPlanTransition(plan.status as never, "canceled");

    // 1. 取消真实外部作业（best-effort，在事务外执行远程调用）。
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
        releaseStage: { select: { id: true, concurrencyKey: true } },
      },
    });
    for (const attempt of activeAttempts) {
      await this.cancelAttemptExternalJob(teamId, actorId, attempt);
    }

    // 2. 单一事务：翻转所有 release 行 + 释放租约 + 追加事件，原子提交
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.releasePlan.updateMany({
        where: { id: planId, status: { notIn: ["succeeded", "canceled"] } },
        data: { status: "canceled", canceledAt: now, finishedAt: now },
      });
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
    });
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

  // 显式重试失败阶段：在一个事务内重开 plan（failed→running）+ 重开 stage
  // （failed→ready），并追加事件。CAS 谓词 status:"failed" 是并发守卫——
  // 第二个并发重试 count===0 → ConflictException（幂等落败）。事务提交后由
  // coordinator.advancePlan 认领重开阶段并创建新 attempt（attemptNo+1）。
  async retryStage(
    teamId: string,
    planId: string,
    stageId: string,
    actorId: string,
  ): Promise<void> {
    this.assertEnabled();
    await this.prisma.$transaction(async (tx) => {
      const stage = await tx.releaseStage.findUniqueOrThrow({ where: { id: stageId } });
      if (stage.releasePlanId !== planId || stage.teamId !== teamId) {
        throw new NotFoundException("阶段不存在");
      }
      if (stage.status !== "failed") {
        throw new ConflictException(`仅失败阶段可重试，当前 ${stage.status}`);
      }
      // 1. 重开 plan：failed→running，清 finishedAt/blockedReason（CAS status:"failed" 幂等）
      await tx.releasePlan.updateMany({
        where: { id: planId, status: "failed" },
        data: { status: "running", finishedAt: null, blockedReason: null },
      });
      // 2. 重开 stage：failed→ready（Slice 1 已合法）
      assertLegalStageTransition("failed", "ready");
      const stageCas = await tx.releaseStage.updateMany({
        where: { id: stageId, status: "failed" },
        data: { status: "ready", blockedReason: null },
      });
      if (stageCas.count === 0) {
        throw new ConflictException("阶段已被并发重试或状态已变更");
      }
      // 3. 事件随事务一起提交
      await tx.releaseEvent.create({
        data: {
          releasePlanId: planId,
          releaseStageId: stageId,
          teamId,
          eventType: RELEASE_AUDIT_ACTIONS.stage_retried,
          actorId,
          summary: `阶段 ${stage.key} 重试`,
        },
      });
    });
    // 事务提交后再推进：advancePlan 自身有自己的 per-stage 事务
    await this.coordinator.advancePlan(planId, actorId);
  }

  // 重新申请审批：仅 blocked（因审批被拒绝）的阶段可调用。
  // 作废最新的已拒绝阶段审批，使下次 advancePlan 重建 pending。
  async reRequestApproval(
    teamId: string,
    planId: string,
    stageId: string,
    actorId: string,
  ): Promise<void> {
    this.assertEnabled();
    const stage = await this.stageRepo.findById(stageId);
    if (!stage || stage.releasePlanId !== planId || stage.teamId !== teamId) {
      throw new NotFoundException("阶段不存在");
    }
    if (stage.status !== "blocked") {
      throw new ConflictException(`仅被阻塞的阶段可重新申请审批，当前 ${stage.status}`);
    }
    assertLegalStageTransition("blocked", "awaiting_approval");
    const updated = await this.stageRepo.updateStatusIf(
      stageId,
      ["blocked"],
      { status: "awaiting_approval", blockedReason: null },
    );
    if (updated === 0) {
      throw new ConflictException("阶段已被并发修改");
    }
    await this.approvalLifecycle.voidLatestRejected(teamId, stageId);
    await this.eventRepo.append({
      releasePlanId: planId,
      releaseStageId: stageId,
      teamId,
      eventType: RELEASE_AUDIT_ACTIONS.stage_approval_re_requested,
      actorId,
      summary: `阶段 ${stage.key} 重新申请审批`,
    });
    await this.coordinator.advancePlan(planId, actorId);
  }
  async skipStage(
    teamId: string,
    planId: string,
    stageId: string,
    actorId: string,
    body: { reason: string; confirmationText: string },
  ): Promise<void> {
    this.assertEnabled();
    const stage = await this.stageRepo.findById(stageId);
    if (!stage || stage.releasePlanId !== planId || stage.teamId !== teamId) {
      throw new NotFoundException("阶段不存在");
    }
    if (stage.required) {
      throw new ForbiddenException("必需阶段不可跳过");
    }
    if (!body.reason?.trim()) {
      throw new BadRequestException("跳过必须填写原因");
    }
    if (body.confirmationText !== SKIP_CONFIRMATION) {
      throw new BadRequestException(`确认文本必须为：${SKIP_CONFIRMATION}`);
    }
    assertLegalStageTransition(stage.status as never, "skipped");
    await this.stageRepo.update(stageId, { status: "skipped", blockedReason: body.reason });
    await this.eventRepo.append({
      releasePlanId: planId,
      releaseStageId: stageId,
      teamId,
      eventType: RELEASE_AUDIT_ACTIONS.stage_skipped,
      actorId,
      summary: `阶段 ${stage.key} 被跳过：${body.reason}`,
      metadata: { reason: body.reason },
    });
    await this.coordinator.advancePlan(planId, actorId);
  }

  // 心跳续约（执行中的 attempt）
  async heartbeat(attemptId: string, owner: string): Promise<number> {
    return this.attemptRepo.heartbeat(attemptId, owner, new Date(Date.now() + LEASE_MS));
  }

  // 解析 git ref（invest-3 §B.2）：分支 → commit SHA。
  // 若 input.gitRepo + input.branch 提供但 commitSha 缺失，则尝试 git ls-remote。
  // 解析失败（不可达/超时/畸形）抛 BadRequest RELEASE_GIT_UNRESOLVABLE，
  // 拦截 preview/create；成功则回填 input.commitSha，由 builder 冻结到
  // 阶段 configSnapshot + planHash。
  private async resolveGitRefInto(input: ReleasePlanBuildInput): Promise<void> {
    if (!input.gitRepo || !input.branch) return;
    if (input.commitSha) return;
    const resolved = await resolveGitRef(input.gitRepo, input.branch);
    if (!resolved) {
      throw new BadRequestException({
        code: "RELEASE_GIT_UNRESOLVABLE",
        message: `无法解析分支 ${input.branch} 的提交，请检查仓库地址与分支`,
      });
    }
    input.commitSha = resolved.commitSha;
  }
}

const LEASE_MS = 15 * 60 * 1000;
export const RELEASE_SKIP_CONFIRMATION_TEXT = SKIP_CONFIRMATION;
