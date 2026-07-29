/**
 * 发布协调器纯函数助手（从 release-coordinator.service.ts 抽离，单一职责）。
 * 这些函数不持有可变状态，依赖以参数传入，便于单测与复用。
 *
 * 抽离的职责：
 *  - interpretTerminalNow：terminal.result → ReleaseStageExecutionResult（适配器解释）。
 *  - usableApprovalIdNow：审批绑定守卫（approved + 未消费 + inputHash 匹配）。
 *  - recomputePlanStatusNow：基于全部阶段状态 CAS 重算计划状态（CR-1-F3）。
 *  - releaseLeaseOutsideTxNow：终态收尾释放并发租约（CR-1-F8，owner 范围）。
 */
import type { PrismaService } from "../prisma/prisma.service";
import type { ReleaseStageRepository } from "./repository/release-stage.repository";
import type { ReleasePlanRepository } from "./repository/release-plan.repository";
import {
  interpretServerCommandResult,
  interpretDeploymentRunResult,
} from "./stage-adapters/release-adapter-interpret.utils";
import { expectedStageInputHash } from "./utils/release-approval-predicate.utils";
import { derivePlanStatusFromStages } from "./utils/release-state-machine.utils";
import type { EnsureApprovalResult } from "./release-approval-lifecycle.service";
import type { ReadinessStageView } from "./release-readiness.service";
import type {
  ReleaseCoordinatorTerminal,
} from "./release-coordinator.port";
import type {
  ReleaseStageExecutionResult,
} from "./stage-adapters/release-stage-adapter.types";
import type { ReleaseStageStatus } from "./types/release-orchestration.types";

// terminal.result 形状镜像 ServerExecutionJob/DeploymentRun 终态；沿用现有解释器
export function interpretTerminalNow(
  terminal: ReleaseCoordinatorTerminal,
): ReleaseStageExecutionResult {
  return terminal.kind === "deploymentRun"
    ? interpretDeploymentRunResult(terminal.result)
    : interpretServerCommandResult(terminal.result);
}

// 仅当审批处于 approved 且未消费，且 inputHash 匹配当前阶段期望 configHash 派生值时绑定（CR-2-P2）。
export function usableApprovalIdNow(
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

export interface PlanStatusDeps {
  stageRepo: ReleaseStageRepository;
  planRepo: ReleasePlanRepository;
}

// 重算计划状态（基于全部阶段状态）。
// CR-1-F3：CAS（updateStatusIf），排除 succeeded/canceled 终态，避免并发 advancePlan 下
// last-writer-wins 丢失更新。failed 保留在谓词内，使 retry 重开后 recompute 仍能更新。
export async function recomputePlanStatusNow(
  deps: PlanStatusDeps,
  releasePlanId: string,
): Promise<void> {
  const stages = await deps.stageRepo.listByPlan(releasePlanId);
  const derived = derivePlanStatusFromStages(
    stages.map((s) => s.status as ReleaseStageStatus),
  );
  const plan = await deps.planRepo.findById(releasePlanId);
  if (!plan) return;
  if (["succeeded", "canceled"].includes(plan.status)) return;
  const patch: {
    status: string;
    blockedReason?: string | null;
    startedAt?: Date;
    finishedAt?: Date;
  } = { status: derived.status };
  if (derived.blockedReason !== undefined) patch.blockedReason = derived.blockedReason;
  if (derived.status === "running" && !plan.startedAt) patch.startedAt = new Date();
  if (["succeeded", "failed", "canceled"].includes(derived.status) && !plan.finishedAt) {
    patch.finishedAt = new Date();
  }
  await deps.planRepo.updateStatusIf(
    releasePlanId,
    ["draft", "awaiting_approval", "ready", "running", "blocked", "failed"],
    patch,
  );
}

// 终态收尾后释放并发租约（事务外尽力而为；过期租约也会被 acquire 清扫）。
// CR-1-F8：按 owner 范围删除——仅释放当前 attempt.leaseOwner 持有的行，
// 避免误删同一 concurrencyKey 上其他 owner（时钟漂移场景）的有效租约。
export async function releaseLeaseOutsideTxNow(
  prisma: PrismaService,
  concurrencyKey: string,
  owner: string | null,
): Promise<void> {
  await prisma.releaseConcurrencyLease.deleteMany({
    where: owner ? { concurrencyKey, owner } : { concurrencyKey },
  });
}
