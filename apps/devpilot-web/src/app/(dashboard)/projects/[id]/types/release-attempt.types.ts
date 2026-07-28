/** 项目详情域 - 发布阶段尝试与结构化输出类型（F383）。
 *  单一职责：阶段尝试（attempt）、关联审批、结构化输出契约。 */

/** 阶段结构化输出（适配器返回 / 哨兵解析）。 */
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

/** 单次阶段执行尝试。 */
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
