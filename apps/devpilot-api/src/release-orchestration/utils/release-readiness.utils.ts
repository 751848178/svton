/**
 * 依赖条件解释与就绪/阻塞推导（纯函数）。
 * output_match 只解释白名单操作符，禁止 eval。
 */
import type {
  OutputMatchRule,
  ReleaseDependencyConditionType,
  ReleaseStageFacts,
  ReleaseStageOutput,
  ReleaseStageStatus,
} from "../types/release-orchestration.types";

// 从结构化输出按点路径取值：values.foo / metrics.bar / summary
export function readOutputPath(
  output: ReleaseStageOutput | null | undefined,
  path: string,
): unknown {
  if (!output || !path) return undefined;
  const parts = path.split(".");
  if (parts.length === 0) return undefined;
  let current: unknown = output;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// 解释单条 output_match 规则
export function evaluateOutputRule(
  output: ReleaseStageOutput | null | undefined,
  rule: OutputMatchRule,
): boolean {
  const value = readOutputPath(output, rule.path);
  switch (rule.operator) {
    case "exists":
      return value !== undefined && value !== null;
    case "bool_true":
      return value === true;
    case "bool_false":
      return value === false;
    case "eq":
      return compareEqual(value, rule.value);
    case "ne":
      return !compareEqual(value, rule.value);
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return compareNumeric(value, rule.value, rule.operator);
    default:
      return false;
  }
}

function compareEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b;
  return String(a) === String(b);
}

function compareNumeric(
  a: unknown,
  b: unknown,
  op: "gt" | "gte" | "lt" | "lte",
): boolean {
  const left = typeof a === "number" ? a : Number(a);
  const right = typeof b === "number" ? b : Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  switch (op) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
  }
}

// 解释一条依赖条件，决定是否满足
export function evaluateDependencyCondition(
  conditionType: ReleaseDependencyConditionType,
  depStatus: ReleaseStageStatus,
  depOutput: ReleaseStageOutput | null | undefined,
  depApprovalApproved: boolean,
  rules?: OutputMatchRule[],
): boolean {
  switch (conditionType) {
    case "succeeded":
      return depStatus === "succeeded";
    case "completed":
      // 允许成功或显式跳过，仅用于 optional 节点
      return depStatus === "succeeded" || depStatus === "skipped";
    case "approved":
      return depApprovalApproved === true;
    case "output_match":
      return (rules ?? []).every((rule) => evaluateOutputRule(depOutput, rule));
    default:
      return false;
  }
}

export interface ReadinessResult {
  ready: boolean;
  blocked: boolean;
  blockedReason?: string;
  awaitingApproval: boolean;
}

// 从阶段事实推导就绪/阻塞状态
export function deriveStageReadiness(
  facts: ReleaseStageFacts,
): ReadinessResult {
  if (!facts.releaseExecutable) {
    return {
      ready: false,
      blocked: true,
      blockedReason: "发布计划当前不可执行",
      awaitingApproval: false,
    };
  }
  // 终态不再推导为 ready
  const terminal = new Set<ReleaseStageStatus>([
    "succeeded",
    "skipped",
    "canceled",
  ]);
  if (terminal.has(facts.status)) {
    return { ready: false, blocked: false, awaitingApproval: false };
  }
  if (facts.hasActiveAttempt) {
    return { ready: false, blocked: false, awaitingApproval: false };
  }
  // 依赖条件
  const unmet = facts.dependencies.filter((edge) => {
    const dep = facts.dependencyStates.find(
      (d) => d.dependsOnStageId === edge.dependsOnStageId,
    );
    if (!dep) return true;
    return !evaluateDependencyCondition(
      edge.conditionType,
      dep.status,
      dep.output,
      dep.approvalApproved ?? false,
      edge.rules,
    );
  });
  if (unmet.length > 0) {
    return {
      ready: false,
      blocked: true,
      blockedReason: `等待依赖完成：${unmet
        .map((u) => u.dependsOnStageId)
        .join(", ")}`,
      awaitingApproval: false,
    };
  }
  // 审批门禁
  if (!facts.approvalSatisfied) {
    return {
      ready: false,
      blocked: false,
      awaitingApproval: true,
    };
  }
  // 并发键
  if (!facts.concurrencyAvailable) {
    return {
      ready: false,
      blocked: true,
      blockedReason: "等待并发键释放（同目标已有进行中阶段）",
      awaitingApproval: false,
    };
  }
  return { ready: true, blocked: false, awaitingApproval: false };
}
