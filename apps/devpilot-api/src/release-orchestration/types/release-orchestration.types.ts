/**
 * 发布编排（F383）纯类型定义。无运行时依赖，仅类型与常量。
 * 状态机/依赖/输出等纯函数实现见 utils/。
 */

// 发布计划状态
export const RELEASE_PLAN_STATUSES = [
  "draft",
  "awaiting_approval",
  "ready",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "canceled",
] as const;
export type ReleasePlanStatus = (typeof RELEASE_PLAN_STATUSES)[number];

// 阶段状态
export const RELEASE_STAGE_STATUSES = [
  "pending",
  "blocked",
  "awaiting_approval",
  "ready",
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "canceled",
] as const;
export type ReleaseStageStatus = (typeof RELEASE_STAGE_STATUSES)[number];

// 阶段类型
export const RELEASE_STAGE_TYPES = [
  "precheck",
  "schema_migration",
  "bootstrap",
  "data_backfill",
  "application_deploy",
  "health_check",
  "manual_gate",
  "custom_command",
] as const;
export type ReleaseStageType = (typeof RELEASE_STAGE_TYPES)[number];

// 执行器类型
export const RELEASE_STAGE_EXECUTOR_KINDS = [
  "server_command",
  "deployment_run",
  "manual_gate",
  "shell",
] as const;
export type ReleaseStageExecutorKind =
  (typeof RELEASE_STAGE_EXECUTOR_KINDS)[number];

// 依赖条件类型
export const RELEASE_DEPENDENCY_CONDITION_TYPES = [
  "succeeded",
  "completed",
  "output_match",
  "approved",
] as const;
export type ReleaseDependencyConditionType =
  (typeof RELEASE_DEPENDENCY_CONDITION_TYPES)[number];

// 尝试状态
export const RELEASE_STAGE_ATTEMPT_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "canceled",
] as const;
export type ReleaseStageAttemptStatus =
  (typeof RELEASE_STAGE_ATTEMPT_STATUSES)[number];

// 风险级别
export const RELEASE_RISK_LEVELS = ["low", "medium", "high"] as const;
export type ReleaseRiskLevel = (typeof RELEASE_RISK_LEVELS)[number];

// 发布计划模式
export const RELEASE_PLAN_MODES = ["preview", "live"] as const;
export type ReleasePlanMode = (typeof RELEASE_PLAN_MODES)[number];

// 触发来源
export const RELEASE_SOURCES = ["manual", "api", "webhook"] as const;
export type ReleaseSource = (typeof RELEASE_SOURCES)[number];
export const RELEASE_TRIGGERS = ["manual", "api", "git_push"] as const;
export type ReleaseTrigger = (typeof RELEASE_TRIGGERS)[number];

// 阶段终态：成功/跳过/取消不可重试覆盖
export const RELEASE_STAGE_TERMINAL_STATUSES = [
  "succeeded",
  "skipped",
  "canceled",
] as const;
export type ReleaseStageTerminalStatus =
  (typeof RELEASE_STAGE_TERMINAL_STATUSES)[number];

// 结构化输出 schema 版本
export const RELEASE_OUTPUT_SCHEMA_VERSION = 1;

/**
 * 阶段结构化输出（适配器返回，或从 shell 哨兵解析）。
 * 值只允许 JSON 安全类型，禁止函数/Buffer。
 */
export interface ReleaseStageOutput {
  schemaVersion: number;
  summary?: string;
  values?: Record<string, unknown>;
  metrics?: Record<string, number>;
  artifacts?: Array<{
    name: string;
    kind?: string;
    ref?: string;
    digest?: string;
  }>;
}

// output_match 白名单比较操作符
export const OUTPUT_MATCH_OPERATORS = [
  "eq",
  "ne",
  "exists",
  "bool_true",
  "bool_false",
  "gt",
  "gte",
  "lt",
  "lte",
] as const;
export type OutputMatchOperator = (typeof OUTPUT_MATCH_OPERATORS)[number];

// output_match 单条规则
export interface OutputMatchRule {
  path: string; // 形如 "values.migrationCount"
  operator: OutputMatchOperator;
  value?: string | number | boolean;
}

// 依赖边（纯函数视角）
export interface ReleaseDependencyEdge {
  stageId: string;
  dependsOnStageId: string;
  conditionType: ReleaseDependencyConditionType;
  // output_match 条件快照
  rules?: OutputMatchRule[];
  // approved 条件所需审批标识
  approvalRef?: string;
}

// 阶段定义（纯函数视角，与持久化字段解耦）
export interface ReleaseStageDefinition {
  key: string;
  name: string;
  type: ReleaseStageType;
  executorKind: ReleaseStageExecutorKind;
  required: boolean;
  riskLevel: ReleaseRiskLevel;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  environmentId?: string | null;
  serverId?: string | null;
  configHash?: string | null;
  configSnapshot?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  concurrencyKey?: string | null;
}

// 阶段当前派生事实（喂给就绪计算）
export interface ReleaseStageFacts {
  stageId: string;
  status: ReleaseStageStatus;
  required: boolean;
  currentAttempt: number;
  hasActiveAttempt: boolean;
  dependencies: ReleaseDependencyEdge[];
  // 依赖阶段当前状态与输出
  dependencyStates: Array<{
    dependsOnStageId: string;
    status: ReleaseStageStatus;
    output?: ReleaseStageOutput | null;
    approvalApproved?: boolean;
  }>;
  approvalSatisfied: boolean;
  releaseExecutable: boolean;
  concurrencyAvailable: boolean;
}

// 哨兵格式
export const RELEASE_OUTPUT_SENTINEL = "@@DEVPILOT_OUTPUT@@";
export const RELEASE_OUTPUT_MAX_BYTES = 64 * 1024;

// feature flag 配置键
export const RELEASE_ORCHESTRATION_FLAG =
  "DEVPILOT_RELEASE_ORCHESTRATION_ENABLED";

// 审计 category
export const RELEASE_AUDIT_CATEGORY = "release_plan";
export const RELEASE_AUDIT_ACTIONS = {
  plan_previewed: "release_plan.previewed",
  plan_created: "release_plan.created",
  plan_executed: "release_plan.executed",
  plan_canceled: "release_plan.canceled",
  stage_claimed: "release_stage.claimed",
  stage_finished: "release_stage.finished",
  stage_retried: "release_stage.retried",
  stage_skipped: "release_stage.skipped",
  stage_blocked: "release_stage.blocked",
  stage_approval_re_requested: "release_stage.approval_re_requested",
} as const;

// 审批 category/action（绑发布阶段）
export const RELEASE_APPROVAL_CATEGORY = "release_plan";
export const RELEASE_APPROVAL_ACTION_PREFIX = "release_stage.";
