/**
 * 发布阶段→部署审批桥接的类型与纯校验谓词（F383 P0-B 结构约束拆分）。
 * 单一职责：把「父发布阶段审批是否可桥接」的判定从桥接服务里隔离为纯函数，
 * 便于独立单测，并保持桥接服务 ≤200 行。
 */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { expectedStageInputHash } from "./utils/release-approval-predicate.utils";
import { RELEASE_APPROVAL_CATEGORY } from "./types/release-orchestration.types";

/** 桥接派生审批的固定系统标记（写入 metadata.bridgedBy）。 */
export const BRIDGE_REVIEWER_MARKER = "release-deployment-approval-bridge";

/** 桥接派生审批记录在 metadata 的父审批链路形状。 */
export interface ApprovalBridgeMetadata {
  releaseApprovalId: string;
  releaseStageId: string;
  releasePlanId: string;
  stageKey: string;
  stageType: string;
  bridgedBy: typeof BRIDGE_REVIEWER_MARKER;
  bridgedAt: string;
}

/** 父审批行的最小形状（findByIdForTeam 返回子集）。 */
export type ParentApprovalRow = {
  id: string;
  category: string;
  status: string;
  consumedAt?: Date | null;
  expiresAt?: Date | null;
  targetType: string;
  targetId?: string | null;
  inputHash?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  requesterId?: string | null;
};

/** 校验所需阶段/计划/上下文最小输入。 */
export interface ParentVerificationInput {
  teamId: string;
  releaseApprovalId: string;
  stage: { id: string; key: string; configHash?: string | null };
  plan: { id: string; projectId: string; environmentId: string };
}

/**
 * 严格校验父发布阶段审批可否桥接。任何不满足抛对应异常（fail-closed）。
 * 纯函数（不读 DB）：调用方先 load 行，再传入本函数判定。
 */
export function assertParentApprovalBridgable(
  parent: ParentApprovalRow | null,
  input: ParentVerificationInput,
): asserts parent is ParentApprovalRow {
  if (!parent) {
    throw new NotFoundException("父发布阶段审批不存在或不属于当前团队");
  }
  if (parent.category !== RELEASE_APPROVAL_CATEGORY) {
    throw new BadRequestException(
      `审批 ${input.releaseApprovalId} 不是发布阶段审批（category=${parent.category}）`,
    );
  }
  if (parent.status !== "approved") {
    throw new BadRequestException(
      `父发布阶段审批尚未批准（status=${parent.status}）`,
    );
  }
  if (parent.consumedAt) {
    throw new BadRequestException("父发布阶段审批已被消费");
  }
  if (parent.expiresAt && parent.expiresAt.getTime() < Date.now()) {
    throw new BadRequestException("父发布阶段审批已过期");
  }
  if (parent.targetType !== "release_stage" || parent.targetId !== input.stage.id) {
    throw new BadRequestException("父发布阶段审批与当前阶段不匹配");
  }
  const expectedHash = expectedStageInputHash({
    releasePlanId: input.plan.id,
    key: input.stage.key,
    environmentId: input.plan.environmentId,
    configHash: input.stage.configHash,
  });
  if ((parent.inputHash ?? "") !== expectedHash) {
    throw new BadRequestException("父发布阶段审批的输入哈希与当前阶段配置不匹配");
  }
  if (parent.projectId !== input.plan.projectId) {
    throw new BadRequestException("父发布阶段审批的项目范围与计划不一致");
  }
  if (parent.environmentId !== input.plan.environmentId) {
    throw new BadRequestException("父发布阶段审批的环境范围与计划不一致");
  }
}
