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
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleaseStageAttemptRepository } from "./repository/release-stage-attempt.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ReleaseCoordinatorService } from "./release-coordinator.service";
import {
  buildReleasePlan,
  type ReleasePlanBuildInput,
  type ReleasePlanPreview,
} from "./utils/release-plan-builder.utils";
import { redactSecretsInObject } from "./utils/release-redact.utils";
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
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly planRepo: ReleasePlanRepository,
    private readonly stageRepo: ReleaseStageRepository,
    private readonly attemptRepo: ReleaseStageAttemptRepository,
    private readonly eventRepo: ReleaseEventRepository,
    private readonly coordinator: ReleaseCoordinatorService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>(RELEASE_ORCHESTRATION_FLAG) === "true";
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ForbiddenException("发布编排未启用（DEVPILOT_RELEASE_ORCHESTRATION_ENABLED）");
    }
  }

  // 预览：纯解析，不写 DB
  preview(input: ReleasePlanBuildInput): ReleasePlanPreview {
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
    input: ReleasePlanBuildInput & { teamId: string; createdByUserId?: string },
  ): Promise<{ id: string; planHash: string }> {
    this.assertEnabled();
    const preview = this.preview(input);
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

  async cancel(teamId: string, planId: string, actorId: string): Promise<void> {
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.teamId !== teamId) throw new NotFoundException("发布计划不存在");
    assertLegalPlanTransition(plan.status as never, "canceled");
    await this.planRepo.updateStatusIf(
      planId,
      ["draft", "awaiting_approval", "ready", "running", "blocked"],
      { status: "canceled", canceledAt: new Date(), finishedAt: new Date() },
    );
    await this.prisma.releaseStage.updateMany({
      where: { releasePlanId: planId, status: { in: ["pending", "blocked", "awaiting_approval", "ready", "queued"] } },
      data: { status: "canceled" },
    });
    await this.prisma.releaseStageAttempt.updateMany({
      where: { releaseStage: { releasePlanId: planId }, status: { in: ["queued", "running"] } },
      data: { status: "canceled", finishedAt: new Date(), leaseOwner: null, leaseExpiresAt: null },
    });
    await this.eventRepo.append({
      releasePlanId: planId,
      teamId,
      eventType: RELEASE_AUDIT_ACTIONS.plan_canceled,
      actorId,
      summary: "发布计划已取消",
    });
  }

  // 显式重试失败阶段：创建新 attempt 并重新推进
  async retryStage(
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
    if (stage.status !== "failed") {
      throw new ConflictException(`仅失败阶段可重试，当前 ${stage.status}`);
    }
    assertLegalStageTransition("failed", "ready");
    await this.stageRepo.update(stageId, { status: "ready", blockedReason: null });
    await this.eventRepo.append({
      releasePlanId: planId,
      releaseStageId: stageId,
      teamId,
      eventType: RELEASE_AUDIT_ACTIONS.stage_retried,
      actorId,
      summary: `阶段 ${stage.key} 重试`,
    });
    await this.coordinator.advancePlan(planId, actorId);
  }

  // 受控跳过：仅 optional 阶段；必需阶段永远禁止
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
}

const LEASE_MS = 15 * 60 * 1000;
export const RELEASE_SKIP_CONFIRMATION_TEXT = SKIP_CONFIRMATION;
