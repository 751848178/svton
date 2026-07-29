/**
 * 阶段绑定审批判定纯函数：readiness 与 coordinator 共享同一语义。
 * 审批“可用”= 已批准 + inputHash 与当前 configHash 派生值一致 + 未消费 + 未过期。
 */
import { computeApprovalInputHash } from "./release-hash.utils";
import type { CreateOperationApprovalInput } from "../../operation-approval/operation-approval.types";
import type { ReadinessStageView } from "../release-readiness.service";

export interface StageApprovalView {
  id?: string;
  status: string;
  inputHash: string | null;
  expiresAt?: Date | null;
  consumedAt?: Date | null;
}

// 计算阶段当前 configHash 对应的期望 inputHash
export function expectedStageInputHash(stage: {
  releasePlanId: string;
  key: string;
  environmentId?: string | null;
  configHash?: string | null;
}): string {
  return computeApprovalInputHash({
    releasePlanId: stage.releasePlanId,
    stageKey: stage.key,
    environmentId: stage.environmentId ?? "",
    configHash: stage.configHash ?? "",
  });
}

// 阶段绑定审批是否“可用”（满足门禁）。approval 缺失 → false。
export function isStageApprovalUsable(stage: {
  executorKind: string;
  riskLevel: string;
  releasePlanId: string;
  key: string;
  environmentId?: string | null;
  configHash?: string | null;
  stageApproval?: StageApprovalView | null;
}): boolean {
  const approval = stage.stageApproval;
  if (!approval) return false;
  if (approval.status !== "approved") return false;
  if (approval.consumedAt) return false;
  if (approval.expiresAt && approval.expiresAt.getTime() < Date.now()) return false;
  const expected = expectedStageInputHash(stage);
  return (approval.inputHash ?? "") === expected;
}

// 构造阶段绑定审批的 createPending 输入（纯函数，便于单测）
export function buildStageApprovalCreateInput(stage: {
  id: string;
  teamId: string;
  key: string;
  name: string;
  type: string;
  riskLevel: string;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  environmentId?: string | null;
  configHash?: string | null;
}, plan: {
  id: string;
  projectId: string;
  environmentId: string;
  name: string;
  createdByUserId?: string | null;
}, category: string, actionPrefix: string): CreateOperationApprovalInput {
  const inputHash = expectedStageInputHash({
    releasePlanId: plan.id,
    key: stage.key,
    environmentId: plan.environmentId,
    configHash: stage.configHash,
  });
  return {
    teamId: stage.teamId,
    requesterId: plan.createdByUserId ?? null,
    projectId: plan.projectId,
    environmentId: plan.environmentId,
    applicationId: stage.applicationId ?? null,
    applicationServiceId: stage.applicationServiceId ?? null,
    serverId: stage.serverId ?? null,
    category,
    action: `${actionPrefix}${stage.type}`,
    targetType: "release_stage",
    targetId: stage.id,
    risk: stage.riskLevel,
    summary: `${plan.name} / ${stage.name} (${stage.key})`,
    reason: `发布阶段 ${stage.name} 需要审批`,
    inputHash,
    reusePending: true,
    metadata: {
      releasePlanId: plan.id,
      stageKey: stage.key,
      configHash: stage.configHash ?? null,
      riskLevel: stage.riskLevel,
    },
  };
}
