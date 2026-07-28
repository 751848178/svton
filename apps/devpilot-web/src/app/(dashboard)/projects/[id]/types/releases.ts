/** 项目详情域 - 发布编排类型（F383）。单一职责：发布计划/阶段/尝试/事件的接口契约。 */

export interface ReleaseStageOutput {
  schemaVersion: number;
  summary?: string;
  values?: Record<string, unknown>;
  metrics?: Record<string, number>;
  artifacts?: Array<{ name: string; kind?: string; ref?: string }>;
}

/** 输出契约（outputSchema）。后端可只返回子集。 */
export interface ReleaseStageOutputSchema {
  [key: string]: unknown;
}

/**
 * 关联审批条目。后端 releasePlanDetailInclude 当前仅 select {id,status,consumedAt}，
 * 其余为 Slice 8b 要求的扩展字段，标记可选。
 */
export interface ReleaseStageAttemptApproval {
  id: string;
  status?: string | null;
  consumedAt?: string | null;
  risk?: string | null;
  reason?: string | null;
  reviewComment?: string | null;
  reviewerId?: string | null;
  reviewer?: { id: string; name: string | null; email: string } | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  inputHash?: string | null;
  expiresAt?: string | null;
}

export interface ReleaseStageAttempt {
  id: string;
  attemptNo: number;
  status: string;
  deploymentRunId?: string | null;
  serverExecutionJobId?: string | null;
  operationApprovalId?: string | null;
  /** 嵌套审批详情（扩展字段，后端尚未全量返回）。 */
  operationApproval?: ReleaseStageAttemptApproval | null;
  output?: ReleaseStageOutput | null;
  logSummary?: Record<string, unknown> | null;
  error?: string | null;
  leaseOwner?: string | null;
  leaseExpiresAt?: string | null;
  heartbeatAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export interface ReleaseStageDependency {
  id: string;
  stageId: string;
  dependsOnStageId: string;
  conditionType: string;
  conditionSnapshot?: Record<string, unknown> | null;
}

export interface ReleaseStage {
  id: string;
  releasePlanId: string;
  key: string;
  name: string;
  type: string;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  applicationServiceName?: string | null;
  environmentId?: string | null;
  /** 真实目标服务器（builder 已写入 stage）。 */
  serverId?: string | null;
  executorKind: string;
  configHash?: string | null;
  /** 输入快照（builder 写入的 stage 级配置，含 command/branch/commitSha 等）。 */
  configSnapshot?: Record<string, unknown> | null;
  /** 该阶段产出的结构契约（可选，仅用于展示）。 */
  outputSchema?: ReleaseStageOutputSchema | null;
  riskLevel: string;
  required: boolean;
  status: string;
  blockedReason?: string | null;
  currentAttempt: number;
  /** Git 版本（builder 写入，便于阶段卡片展示真实目标）。 */
  branch?: string | null;
  commitSha?: string | null;
  gitRepo?: string | null;
  dependencies?: ReleaseStageDependency[];
  attempts?: ReleaseStageAttempt[];
  createdAt: string;
  updatedAt: string;
}

export interface ReleasePlan {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  name: string;
  branch?: string | null;
  commitSha?: string | null;
  source: string;
  trigger: string;
  mode: string;
  status: string;
  blockedReason?: string | null;
  planHash?: string | null;
  inputSnapshot?: Record<string, unknown> | null;
  createdByUserId?: string | null;
  createdBy?: { id: string; name: string | null; email: string } | null;
  environment?: { id: string; key: string; name: string } | null;
  stages?: ReleaseStage[];
  events?: ReleaseEvent[];
  startedAt?: string | null;
  finishedAt?: string | null;
  canceledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseEvent {
  id: string;
  releasePlanId: string;
  releaseStageId?: string | null;
  stageAttemptId?: string | null;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  correlationId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// 预览/创建请求里的服务选择器（P0-1：仅选择器字段——命令一律由服务端从
// ApplicationService.deployConfig 解析，客户端不再承载 shell 命令，杜绝「前端命令被信任」的 RCE 面）。
export interface ReleaseServiceInputItem {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string;
  serviceName: string;
}

export interface ReleaseStagePreview {
  key: string;
  name: string;
  type: string;
  executorKind: string;
  required: boolean;
  riskLevel: string;
  configHash?: string | null;
  concurrencyKey?: string | null;
  /** builder 写入的 Git 版本，便于向导预览展示。 */
  branch?: string | null;
  commitSha?: string | null;
  gitRepo?: string | null;
  applicationServiceName?: string | null;
}

/** P0-2(b)：optional 依赖目标缺失/跨域的非阻断警告（预览区展示，不阻止创建）。 */
export interface ReleaseDepWarning {
  code: string;
  applicationServiceId: string;
  serviceName: string;
  dependencyIndex: number;
  toServiceId: string;
  reason: string;
  suggestedAction: string;
}

export interface ReleasePlanPreview {
  stages: ReleaseStagePreview[];
  dependencies: Array<{
    stageKey: string;
    dependsOnStageKey: string;
    conditionType: string;
    required: boolean;
  }>;
  planHash: string;
  sideEffects: string[];
  riskSummary: Array<{ stageKey: string; risk: string }>;
  approvalRequired: Array<{ stageKey: string; reason: string }>;
  /** optional 依赖警告（后端 P0-2b 回传；旧后端可能不带该字段，消费方需容错）。 */
  warnings?: ReleaseDepWarning[];
}

/** 发布编排能力（GET /release-plans/capability）。enabled=false 禁用写动作；canCancel 恒真（逃生通道）。 */
export interface ReleaseCapability {
  enabled: boolean;
  canCancel: boolean;
  canWrite?: boolean | null;
  reason?: 'flag_off' | 'rbac' | null;
}
