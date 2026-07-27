/**
 * 把持久化的计划/阶段/依赖/尝试事实装配为纯函数 ReleaseStageFacts，
 * 并对每个阶段计算就绪/阻塞结论。不执行副作用。
 */
import { Injectable } from "@nestjs/common";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { deriveStageReadiness } from "./utils/release-readiness.utils";
import type { ReadinessResult } from "./utils/release-readiness.utils";
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

  // 风险阶段需要审批；低风险或 manual_gate 直接视为满足
  private isApprovalSatisfied(stage: ReadinessStageView): boolean {
    if (stage.executorKind === "manual_gate") return false;
    if (stage.riskLevel === "low") return true;
    const latest = stage.attempts[0];
    if (!latest?.operationApprovalId) return false;
    const approval = latest.operationApproval;
    return approval?.status === "approved" && !approval?.consumedAt;
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
