/**
 * 阶段适配器统一契约。适配器不直接写 DB 终态，只返回执行结果；
 * 由 coordinator 把结果写入 attempt/stage，并做脱敏与状态机校验。
 */
import type { ReleaseStageOutput } from "../types/release-orchestration.types";

export interface ReleaseStageExecutionContext {
  releasePlanId: string;
  releaseStageId: string;
  attemptId: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  // 已脱敏的配置快照
  configSnapshot: Record<string, unknown> | null;
  configHash: string | null;
  actorId?: string | null;
  // 已批准的审批单（如有）
  operationApprovalId?: string | null;
}

export interface ReleaseStageExecutionResult {
  status: "succeeded" | "failed" | "queued" | "skipped";
  output?: ReleaseStageOutput | null;
  logSummary?: Record<string, unknown> | null;
  error?: string;
  // 关联运行（用于 attempt 回填与恢复回读）
  deploymentRunId?: string | null;
  serverExecutionJobId?: string | null;
  operationApprovalId?: string | null;
}

export interface ReleaseStageAdapter {
  readonly kind: string;
  // 同步执行（dry-run 或快速命令）；返回终态或 queued
  execute(ctx: ReleaseStageExecutionContext): Promise<ReleaseStageExecutionResult>;
  // 排队执行（返回 queued + serverExecutionJobId）
  queue?(ctx: ReleaseStageExecutionContext): Promise<ReleaseStageExecutionResult>;
}
