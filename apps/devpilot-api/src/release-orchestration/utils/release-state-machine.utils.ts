/**
 * 发布计划与阶段合法状态转换（纯函数）。
 * 终态不可覆盖；plan.failed 经受控 retry 转回 running，stage.failed 转回 ready/queued。
 */
import type {
  ReleasePlanStatus,
  ReleaseStageStatus,
} from "../types/release-orchestration.types";

const PLAN_TRANSITIONS: Record<ReleasePlanStatus, ReleasePlanStatus[]> = {
  draft: ["awaiting_approval", "ready", "canceled"],
  awaiting_approval: ["ready", "canceled"],
  ready: ["running", "canceled"],
  running: ["succeeded", "failed", "blocked", "canceled"],
  blocked: ["ready", "running", "canceled"],
  succeeded: [],
  // 失败可经受控 retry 转回 running（仅在 retryStage 事务内），故非终态。
  failed: ["running"],
  canceled: [],
};

const STAGE_TRANSITIONS: Record<ReleaseStageStatus, ReleaseStageStatus[]> = {
  // pending/blocked 可被 coordinator 直接 CAS 到 queued（绕过 ready）
  pending: ["blocked", "awaiting_approval", "ready", "queued", "skipped", "canceled"],
  blocked: ["awaiting_approval", "ready", "queued", "skipped", "canceled"],
  awaiting_approval: ["ready", "canceled"],
  ready: ["queued", "running", "canceled"],
  queued: ["running", "failed", "skipped", "canceled"],
  // running 可被健康探针（0 候选可选阶段）自动跳过为 skipped
  running: ["succeeded", "failed", "skipped", "canceled"],
  failed: ["ready", "queued"], // 仅由显式 retry 创建新 attempt
  succeeded: [],
  skipped: [],
  canceled: [],
};

export function isLegalPlanTransition(
  from: ReleasePlanStatus,
  to: ReleasePlanStatus,
): boolean {
  if (from === to) return true;
  return PLAN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertLegalPlanTransition(
  from: ReleasePlanStatus,
  to: ReleasePlanStatus,
): void {
  if (!isLegalPlanTransition(from, to)) {
    throw new Error(`非法发布计划状态转换：${from} → ${to}`);
  }
}

export function isLegalStageTransition(
  from: ReleaseStageStatus,
  to: ReleaseStageStatus,
): boolean {
  if (from === to) return true;
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertLegalStageTransition(
  from: ReleaseStageStatus,
  to: ReleaseStageStatus,
): void {
  if (!isLegalStageTransition(from, to)) {
    throw new Error(`非法阶段状态转换：${from} → ${to}`);
  }
}

export function isStageTerminal(status: ReleaseStageStatus): boolean {
  return STAGE_TRANSITIONS[status]?.length === 0;
}

export function isPlanTerminal(status: ReleasePlanStatus): boolean {
  return PLAN_TRANSITIONS[status]?.length === 0;
}

// 从所有阶段状态汇总推导发布计划状态
export function derivePlanStatusFromStages(
  stageStatuses: ReleaseStageStatus[],
): {
  status: ReleasePlanStatus;
  blockedReason?: string;
} {
  if (stageStatuses.length === 0) {
    return { status: "ready" };
  }
  const hasFailed = stageStatuses.some((s) => s === "failed");
  if (hasFailed) {
    return { status: "failed", blockedReason: "存在失败阶段" };
  }
  const hasCanceled = stageStatuses.some((s) => s === "canceled");
  if (hasCanceled) {
    return { status: "canceled" };
  }
  const allDone = stageStatuses.every((s) =>
    ["succeeded", "skipped", "canceled"].includes(s),
  );
  if (allDone) {
    return { status: "succeeded" };
  }
  const hasBlocked = stageStatuses.some(
    (s) => s === "blocked" || s === "awaiting_approval",
  );
  if (hasBlocked) {
    const hasRunning = stageStatuses.some(
      (s) => s === "running" || s === "queued",
    );
    if (!hasRunning) {
      return {
        status: "blocked",
        blockedReason: "存在阻塞或待审批阶段且无进行中阶段",
      };
    }
  }
  return { status: "running" };
}
