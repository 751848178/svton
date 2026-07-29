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
  // toLogsText 把数组/对象形态的 logs 归一为真实换行连接的纯文本；之前用
  // JSON.stringify 会把换行变成字面 \n，导致 parseOutputSentinel 的逐行扫描
  // 只看到一行，哨兵解析失败（invest-2 §E.3）。
  const logsText = toLogsText(jobResult.logs);
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
  // blocked 的语义区分：
  //  - result.mode === "blocked_operation_approval"：等待部署审批，是合法的暂态 → queued。
  //    （release application_deploy 已通过审批桥接提供 deployment 审批，正常不应再落到此分支。）
  //  - 其它 blocked（如 deployment-initialization-checkpoint 失败、命令 warning 阻断）：
  //    属真实终态阻塞，不得让发布阶段长期挂 queued/running → failed + 明确原因（fail-closed）。
  if (run.status === "blocked") {
    const mode = readBlockedMode(run.result);
    if (mode === "blocked_operation_approval") {
      return {
        status: "queued",
        logSummary: { deploymentRunStatus: run.status, blockedMode: mode },
        error: run.error ?? undefined,
      };
    }
    return {
      status: "failed",
      logSummary: { deploymentRunStatus: run.status, blockedMode: mode },
      error: run.error ?? "部署运行被阻塞且未进入审批暂态，视为失败",
    };
  }
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

function readBlockedMode(result: unknown): string | undefined {
  if (result && typeof result === "object") {
    const mode = (result as Record<string, unknown>).mode;
    return typeof mode === "string" ? mode : undefined;
  }
  return undefined;
}

/**
 * 把 ServerExecutionJob/DeploymentRun 的 logs 字段（可能是 string / string[] /
 * {stdout,lines,...} 对象 / 其它）归一为真实换行连接的纯文本。
 *
 * 为什么不用 JSON.stringify：它会数组化字符串、把换行转义成字面 `\n`，破坏
 * parseOutputSentinel 的逐行扫描（哨兵会粘在 JSON 的引号/逗号里）。这里保留
 * 真实换行，让哨兵解析能在独立行上命中。
 */
export function toLogsText(logs: unknown): string {
  if (typeof logs === "string") return logs;
  if (Array.isArray(logs)) {
    return logs
      .map((line) =>
        typeof line === "string" ? line : JSON.stringify(line),
      )
      .join("\n");
  }
  if (logs && typeof logs === "object") {
    const o = logs as Record<string, unknown>;
    for (const k of ["stdout", "text", "output", "combined"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
    for (const k of ["lines", "entries"]) {
      if (Array.isArray(o[k])) return toLogsText(o[k]);
    }
  }
  return "";
}
