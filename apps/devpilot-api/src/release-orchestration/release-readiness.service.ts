/**
 * 把持久化的计划/阶段/依赖/尝试事实装配为纯函数 ReleaseStageFacts，
 * 并对每个阶段计算就绪/阻塞结论。不执行副作用。
 */
import { Injectable } from "@nestjs/common";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { deriveStageReadiness } from "./utils/release-readiness.utils";
import type { ReadinessResult } from "./utils/release-readiness.utils";
import { isStageApprovalUsable } from "./utils/release-approval-predicate.utils";
import type { ReleaseStageFacts } from "./types/release-orchestration.types";

const ACTIVE_ATTEMPT_STATUSES = new Set(["queued", "running"]);
const APPROVAL_SATISFIED_STATUSES = new Set(["succeeded", "skipped"]);

// 结构化阶段视图：plan repo 与 stage repo 都能产出兼容形态
export interface ReadinessStageView {
  id: string;
  releasePlanId: string;
  teamId: string;
  key: string;
  name: string;
  type: string;
  status: string;
  required: boolean;
  currentAttempt: number;
  executorKind: string;
  riskLevel: string;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  environmentId?: string | null;
  serverId?: string | null;
  configSnapshot?: unknown;
  configHash?: string | null;
  concurrencyKey?: string | null;
  // 阶段绑定的审批快照（由 coordinator.ensureStageApproval 注入）。
  // readiness 据此判定 approvalSatisfied，不再读 attempt.operationApprovalId。
  stageApproval?: {
    status: string;
    inputHash: string | null;
    expiresAt?: Date | null;
    consumedAt?: Date | null;
  } | null;
  releasePlan: { id: string; projectId: string; environmentId: string; teamId: string };
  dependencies: Array<{
    stageId: string;
    dependsOnStageId: string;
    conditionType: string;
    conditionSnapshot?: unknown;
  }>;
  attempts: Array<{
    id: string;
    attemptNo: number;
    status: string;
    operationApprovalId?: string | null;
    operationApproval?: { status: string; consumedAt: Date | null } | null;
    deploymentRunId?: string | null;
    serverExecutionJobId?: string | null;
    leaseExpiresAt?: Date | null;
    output?: unknown;
  }>;
}

@Injectable()
export class ReleaseReadinessService {
  constructor(private readonly stageRepo: ReleaseStageRepository) {}

  // 装配单阶段事实
  async assembleFacts(stage: ReadinessStageView): Promise<ReleaseStageFacts> {
    const dependencyStates = await Promise.all(
      stage.dependencies.map(async (dep) => {
        const upstream = await this.stageRepo.findById(dep.dependsOnStageId);
        const latestAttempt = upstream?.attempts[0] ?? null;
        const output =
          latestAttempt?.output && typeof latestAttempt.output === "object"
            ? (latestAttempt.output as Record<string, unknown>)
            : null;
        return {
          dependsOnStageId: dep.dependsOnStageId,
          status: (upstream?.status ?? "pending") as ReleaseStageFacts["dependencyStates"][number]["status"],
          output: output as never,
          approvalApproved: APPROVAL_SATISFIED_STATUSES.has(upstream?.status ?? ""),
        };
      }),
    );

    const hasActiveAttempt = stage.attempts.some((a) =>
      ACTIVE_ATTEMPT_STATUSES.has(a.status),
    );

    const approvalSatisfied = this.isApprovalSatisfied(stage);

    const concurrencyAvailable = await this.isConcurrencyAvailable(stage);

    return {
      stageId: stage.id,
      status: stage.status as ReleaseStageFacts["status"],
      required: stage.required,
      currentAttempt: stage.currentAttempt,
      hasActiveAttempt,
      dependencies: stage.dependencies.map((d) => ({
        stageId: d.stageId,
        dependsOnStageId: d.dependsOnStageId,
        conditionType: d.conditionType as ReleaseStageFacts["dependencies"][number]["conditionType"],
        rules: parseConditionRules(d.conditionSnapshot),
      })),
      dependencyStates,
      approvalSatisfied,
      releaseExecutable: true, // 由 plan 级状态决定，调用方覆写
      concurrencyAvailable,
    };
  }

  compute(facts: ReleaseStageFacts): ReadinessResult {
    return deriveStageReadiness(facts);
  }

  // 阶段绑定审批是否满足（不再读取 attempt.operationApprovalId）：
  // - manual_gate：无论风险等级，必须有已批准的阶段绑定审批；
  // - 低风险非 manual_gate：直接满足；
  // - 其它（中/高风险）：需要 stageApproval.status==='approved' 且 inputHash 与当前
  //   configHash 派生值一致、未被消费、未过期。
  private isApprovalSatisfied(stage: ReadinessStageView): boolean {
    if (stage.executorKind === "manual_gate") {
      return isStageApprovalUsable(stage);
    }
    if (stage.riskLevel === "low") return true;
    return isStageApprovalUsable(stage);
  }

  // 同 concurrencyKey 不能有其它进行中阶段
  private async isConcurrencyAvailable(
    stage: ReadinessStageView,
  ): Promise<boolean> {
    if (!stage.concurrencyKey) return true;
    const active = await this.stageRepo.findActiveByConcurrencyKey(
      stage.concurrencyKey,
      stage.id,
    );
    return !active;
  }
}

function parseConditionRules(
  snapshot: unknown,
): ReleaseStageFacts["dependencies"][number]["rules"] {
  if (!snapshot || typeof snapshot !== "object") return undefined;
  const obj = snapshot as { rules?: unknown };
  if (!Array.isArray(obj.rules)) return undefined;
  return obj.rules as ReleaseStageFacts["dependencies"][number]["rules"];
}
