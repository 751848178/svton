/**
 * 发布计划服务：计划生命周期核心——预览、创建、查询、执行、心跳续约、git ref 解析。
 * dry-run 只解析校验显示副作用，不创建任务、不消费审批。正式创建冻结 inputSnapshot + planHash。
 *
 * 已抽离的职责（按 200 行/单职责约定）：
 *   - 取消 → ReleaseCancelService（P0-3 CAS 所有权）
 *   - 重试 / 重新申请审批 / 跳过 → ReleaseStageActionService
 *   - stage 持久化映射 → mapStagesForPersist
 * 本服务只保留 preview/create/get/list/execute/heartbeat/isEnabled/resolveGitRefInto。
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
import { ReleaseStageAttemptRepository } from "./repository/release-stage-attempt.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ReleaseCoordinatorService } from "./release-coordinator.service";
import { buildReleasePlan, type ReleasePlanBuildInput, type ReleasePlanPreview } from "./utils/release-plan-builder.utils";
import { mapStagesForPersist } from "./utils/release-plan-create-mapper.utils";
import { redactSecretsInObject } from "./utils/release-redact.utils";
import { resolveGitRef } from "./utils/release-git-ref.utils";
import { RELEASE_AUDIT_ACTIONS, RELEASE_ORCHESTRATION_FLAG } from "./types/release-orchestration.types";
import { ReleaseCancelService } from "./release-cancel.service";

const LEASE_MS = 15 * 60 * 1000;

@Injectable()
export class ReleasePlanService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly planRepo: ReleasePlanRepository,
    private readonly attemptRepo: ReleaseStageAttemptRepository,
    private readonly eventRepo: ReleaseEventRepository,
    private readonly coordinator: ReleaseCoordinatorService,
    private readonly cancelService: ReleaseCancelService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>(RELEASE_ORCHESTRATION_FLAG) === "true";
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ForbiddenException("发布编排未启用（DEVPILOT_RELEASE_ORCHESTRATION_ENABLED）");
    }
  }

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
    // preview ↔ create 强绑定（invest-3 §C）：客户端回传 expectedPlanHash，与本次重新计算的
    // preview.planHash 不一致即 409。CR-3-F2：expectedPlanHash 现为必填，关闭 hash 校验绕过。
    // P0-2：planHash 绑定依赖图（canonical snapshot），依赖图变化必改变 hash。
    if (preview.planHash !== input.expectedPlanHash) {
      throw new ConflictException({
        code: "RELEASE_PLAN_STALE",
        message: "预览已过期，请重新生成",
        expected: preview.planHash,
        received: input.expectedPlanHash,
      });
    }
    // 持久化阶段用「未脱敏」原始 stages——preview() 已整体 redactSecretsInObject 会把
    // 连接串密码冻结成 [REDACTED]，执行时会以字面量 [REDACTED] 认证失败。重新跑未脱敏
    // buildReleasePlan 取原始 stages；planHash 与 preview 同源（都由 buildReleasePlan 计算）。
    const rawBuild = buildReleasePlan(input);
    if (!rawBuild.ok) {
      throw new BadRequestException({
        code: "RELEASE_PLAN_INVALID",
        message: rawBuild.error.message,
        details: rawBuild.error.details,
      });
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
      stages: mapStagesForPersist(rawBuild.value.stages),
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
    if (!plan || plan.teamId !== teamId) throw new NotFoundException("发布计划不存在");
    return redactSecretsInObject(plan);
  }

  async list(teamId: string, query: { projectId?: string; environmentId?: string; status?: string }) {
    const plans = await this.planRepo.list({ teamId, ...query });
    return redactSecretsInObject(plans);
  }

  async execute(teamId: string, planId: string, actorId: string): Promise<void> {
    this.assertEnabled();
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.teamId !== teamId) throw new BadRequestException("发布计划不存在");
    const updated = await this.planRepo.updateStatusIf(
      planId,
      ["ready", "blocked"],
      { status: "running", startedAt: new Date(), blockedReason: null },
    );
    if (updated === 0) throw new ConflictException(`计划当前状态 ${plan.status} 不可执行`);
    await this.eventRepo.append({
      releasePlanId: planId, teamId,
      eventType: RELEASE_AUDIT_ACTIONS.plan_executed, actorId,
      summary: "开始执行发布计划",
    });
    await this.coordinator.advancePlan(planId, actorId);
  }

  // 取消发布计划：委托 ReleaseCancelService（P0-3 CAS 所有权）。
  async cancel(teamId: string, planId: string, actorId: string): Promise<void> {
    return this.cancelService.cancel(teamId, planId, actorId);
  }

  // 心跳续约（执行中的 attempt）
  async heartbeat(attemptId: string, owner: string): Promise<number> {
    return this.attemptRepo.heartbeat(attemptId, owner, new Date(Date.now() + LEASE_MS));
  }

  // 解析 git ref（invest-3 §B.2）：分支 → commit SHA。
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
