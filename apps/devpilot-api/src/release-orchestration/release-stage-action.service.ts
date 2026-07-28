/**
 * 发布阶段显式动作服务：重试失败阶段、重新申请审批、受控跳过可选阶段。
 * 从 release-plan.service 抽离的单一职责——阶段级显式操作（区别于计划级 preview/create/cancel）。
 *
 * 不直接执行 shell；推进由 coordinator.advancePlan 认领重开/重申请阶段。
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ReleaseCoordinatorService } from "./release-coordinator.service";
import { ReleaseApprovalLifecycleService } from "./release-approval-lifecycle.service";
import { assertLegalStageTransition } from "./utils/release-state-machine.utils";
import { RELEASE_AUDIT_ACTIONS } from "./types/release-orchestration.types";

const SKIP_CONFIRMATION = "我确认跳过此可选阶段";
export const RELEASE_SKIP_CONFIRMATION_TEXT = SKIP_CONFIRMATION;

@Injectable()
export class ReleaseStageActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stageRepo: ReleaseStageRepository,
    private readonly planRepo: ReleasePlanRepository,
    private readonly eventRepo: ReleaseEventRepository,
    private readonly coordinator: ReleaseCoordinatorService,
    private readonly approvalLifecycle: ReleaseApprovalLifecycleService,
  ) {}

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
    // CR-1-F7：事务提交后、advancePlan 前重读 plan——若并发 cancel 已把 plan → canceled，
    // 则把刚重开的 stage 翻回 canceled，避免 ready 阶段困在 canceled 计划下。
    // 失败仅 best-effort 吞掉（cancel 的 plan-level CAS 已是终态，recheck 不一致的概率极低）。
    const postCommitPlan = await this.planRepo.findById(planId);
    if (!postCommitPlan || postCommitPlan.status === "canceled") {
      await this.stageRepo.updateStatusIf(
        stageId,
        ["ready", "queued", "running"],
        { status: "canceled", blockedReason: "计划已被并发取消" },
      ).catch(() => undefined);
      return;
    }
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
}
