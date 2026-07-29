/**
 * 发布阶段绑定审批生命周期：lazy 创建/复用 pending、拒绝→blocked、
 * 过期/配置变更→重建 pending、成功→消费。
 *
 * F383 P0-3 死锁修复：审批绑定到 STAGE 而非 attempt。coordinator 在评估
 * readiness 前调用 ensureStageApproval，使审批在 attempt 创建前就存在，
 * 打破“无审批→不 ready→不建 attempt→不建审批”循环。
 */
import { Injectable, Logger } from "@nestjs/common";
import { OperationApprovalService } from "../operation-approval/operation-approval.service";
import { OperationApprovalRepository } from "../operation-approval/operation-approval.repository";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import {
  buildStageApprovalCreateInput,
  expectedStageInputHash,
  type StageApprovalView,
} from "./utils/release-approval-predicate.utils";
import {
  RELEASE_APPROVAL_ACTION_PREFIX,
  RELEASE_APPROVAL_CATEGORY,
  RELEASE_AUDIT_ACTIONS,
} from "./types/release-orchestration.types";

// ensureStageApproval 需要的阶段最小视图
export interface LifecycleStageView {
  id: string;
  releasePlanId: string;
  teamId: string;
  key: string;
  name: string;
  type: string;
  executorKind: string;
  riskLevel: string;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  environmentId?: string | null;
  serverId?: string | null;
  configHash?: string | null;
}

// ensureStageApproval 需要的计划最小视图
export interface LifecyclePlanView {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  name: string;
  createdByUserId?: string | null;
}

// 审批记录的最小结构（findLatestForTarget / create 返回的子集）
interface ApprovalRecordView {
  id: string;
  status: string;
  inputHash: string | null;
  expiresAt?: Date | null;
  consumedAt?: Date | null;
  reviewComment?: string | null;
}

export interface EnsureApprovalResult {
  // 当前阶段绑定的审批快照（may be null：低风险跳过 / 无可复用且未创建）
  approval: StageApprovalView | null;
  // 是否因拒绝被置为 blocked（coordinator 据此跳过 claim）
  blocked: boolean;
}

const BLOCK_GUARD_STATUSES = ["pending", "blocked", "awaiting_approval"];

@Injectable()
export class ReleaseApprovalLifecycleService {
  private readonly logger = new Logger(ReleaseApprovalLifecycleService.name);

  constructor(
    private readonly approvalService: OperationApprovalService,
    private readonly approvalRepo: OperationApprovalRepository,
    private readonly stageRepo: ReleaseStageRepository,
    private readonly eventRepo: ReleaseEventRepository,
  ) {}

  // 确保阶段存在合适的 pending/已批准审批；返回当前审批快照与 blocked 标记。
  async ensureStageApproval(
    stage: LifecycleStageView,
    plan: LifecyclePlanView,
  ): Promise<EnsureApprovalResult> {
    // 低风险非 manual_gate 不需要审批
    if (stage.riskLevel === "low" && stage.executorKind !== "manual_gate") {
      return { approval: null, blocked: false };
    }

    const latest = await this.approvalRepo.findLatestForTarget(
      stage.teamId,
      "release_stage",
      stage.id,
    );

    if (latest?.status === "rejected") {
      await this.markStageBlocked(stage, plan, latest.reviewComment ?? "");
      return { approval: this.toView(latest), blocked: true };
    }

    const expectedHash = expectedStageInputHash({
      releasePlanId: plan.id,
      key: stage.key,
      environmentId: plan.environmentId,
      configHash: stage.configHash,
    });
    const now = new Date();
    const isPendingUsable =
      latest?.status === "pending" &&
      (!latest.expiresAt || latest.expiresAt.getTime() >= now.getTime()) &&
      (latest.inputHash ?? "") === expectedHash;
    if (isPendingUsable) {
      return { approval: this.toView(latest), blocked: false };
    }

    // approved 且未消费 + 未过期 + inputHash 与当前期望一致 → 复用，不再 mint 第二个 pending
    // （CR-2-1 根因修复：原实现缺失此分支，每次 ensureStageApproval 在人工批准后
    //   都会落回 createPending fallthrough → 第二个 pending → readiness 永不满足 → 死锁）
    const isApprovedUsable =
      latest?.status === "approved" &&
      !latest.consumedAt &&
      (!latest.expiresAt || latest.expiresAt.getTime() >= now.getTime()) &&
      (latest.inputHash ?? "") === expectedHash;
    if (isApprovedUsable) {
      return { approval: this.toView(latest), blocked: false };
    }

    // pending 过期 / inputHash 不匹配 / approved 已消费或过期或 stale / 无审批 → 创建新的 pending
    const created = await this.approvalService.createPending(
      buildStageApprovalCreateInput(
        stage, plan, RELEASE_APPROVAL_CATEGORY, RELEASE_APPROVAL_ACTION_PREFIX,
      ),
    );
    return { approval: this.toView(created), blocked: false };
  }

  // 成功收尾时消费阶段绑定审批（attempt.operationApprovalId 已绑定）
  async consume(
    teamId: string,
    approvalId?: string | null,
  ): Promise<void> {
    if (!approvalId) return;
    try {
      await this.approvalService.consume(teamId, approvalId);
    } catch (err) {
      this.logger.warn(
        `消费审批 ${approvalId} 失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // re-request：作废最新的已拒绝阶段审批（置 cancelled），便于下次 ensureStageApproval 建新 pending
  async voidLatestRejected(
    teamId: string,
    stageId: string,
  ): Promise<number> {
    const latest = await this.approvalRepo.findLatestForTarget(
      teamId,
      "release_stage",
      stageId,
    );
    if (!latest || latest.status !== "rejected") return 0;
    return this.approvalRepo.cancel(latest.id, "rejected");
  }

  private async markStageBlocked(
    stage: LifecycleStageView,
    plan: LifecyclePlanView,
    reviewComment: string,
  ): Promise<void> {
    const reason = `审批被拒绝：${reviewComment}`;
    // CAS：仅当阶段仍处于可阻塞状态时才置 blocked，避免覆盖并发终态转换
    const updated = await this.stageRepo.updateStatusIf(
      stage.id,
      BLOCK_GUARD_STATUSES,
      { status: "blocked", blockedReason: reason },
    );
    if (updated === 0) return;
    await this.eventRepo.append({
      releasePlanId: plan.id,
      releaseStageId: stage.id,
      teamId: stage.teamId,
      eventType: RELEASE_AUDIT_ACTIONS.stage_blocked,
      summary: `阶段 ${stage.key} 审批被拒绝`,
      metadata: { reason: reviewComment },
    });
  }

  private toView(approval: ApprovalRecordView): StageApprovalView {
    return {
      id: approval.id,
      status: approval.status,
      inputHash: approval.inputHash,
      expiresAt: approval.expiresAt,
      consumedAt: approval.consumedAt,
    };
  }
}
