/**
 * 关联运行终态解释（纯函数）：从 ServerExecutionJob / DeploymentRun 的终态
 * 推导发布阶段 attempt 的结果。供恢复链路与适配器共用。
 */
import { parseOutputSentinel } from "../utils/release-output.utils";
import type { ReleaseStageExecutionResult } from "./release-stage-adapter.types";

export interface LinkedRunTerminal {
  status: string;
  result?: unknown;
  logs?: unknown;
  error?: string | null;
}

export function interpretServerCommandResult(
  jobResult: LinkedRunTerminal,
): ReleaseStageExecutionResult {
  const logsText = JSON.stringify(jobResult.logs ?? "");
  const parsed = parseOutputSentinel(logsText);
  const status: ReleaseStageExecutionResult["status"] =
    jobResult.status === "completed"
      ? "succeeded"
      : jobResult.status === "cancelled"
        ? "skipped"
        : "failed";
  return {
    status,
    output: parsed.output,
    logSummary: { cleanedLogsPreview: parsed.cleanedText.slice(-2000) },
    error: jobResult.error ?? undefined,
  };
}

export function interpretDeploymentRunResult(
  run: LinkedRunTerminal,
): ReleaseStageExecutionResult {
  const status: ReleaseStageExecutionResult["status"] =
    run.status === "completed"
      ? "succeeded"
      : run.status === "failed"
        ? "failed"
        : run.status === "cancelled"
          ? "skipped"
          : "queued";
  return {
    status,
    logSummary: { deploymentRunStatus: run.status },
    error: run.error ?? undefined,
  };
}
