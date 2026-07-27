/**
 * 项目详情域 - 发布编排类型（F383）
 *
 * 单一职责：发布计划、阶段、尝试、事件的接口契约。
 */

export interface ReleaseStageOutput {
  schemaVersion: number;
  summary?: string;
  values?: Record<string, unknown>;
  metrics?: Record<string, number>;
  artifacts?: Array<{ name: string; kind?: string; ref?: string }>;
}

export interface ReleaseStageAttempt {
  id: string;
  attemptNo: number;
  status: string;
  deploymentRunId?: string | null;
  serverExecutionJobId?: string | null;
  operationApprovalId?: string | null;
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
  environmentId?: string | null;
  executorKind: string;
  configHash?: string | null;
  riskLevel: string;
  required: boolean;
  status: string;
  blockedReason?: string | null;
  currentAttempt: number;
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

// 预览返回（不持久化）
export interface ReleaseServiceInputItem {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string;
  serviceName: string;
  preStartCheckCommand?: string;
  migrationCommand?: string;
  initializationCommand?: string;
  deployCommand?: string;
  healthCheckUrl?: string;
  backfillCommand?: string;
  backfillRequired?: boolean;
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
}
