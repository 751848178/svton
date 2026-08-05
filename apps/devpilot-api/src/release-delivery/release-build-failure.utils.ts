import { RepositoryGitError } from "../repository-analysis/repository-git-error.utils";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseBuildRunTimeoutError } from "./release-build-runtime-supervisor.service";
import type { ReleaseBuildFailure } from "./release-build.types";

export function releaseBuildFailureDetail(
  error: unknown,
  signal: AbortSignal,
): ReleaseBuildFailure {
  if (signal.aborted) {
    const timedOut = signal.reason instanceof ReleaseBuildRunTimeoutError;
    return {
      code: timedOut ? "BUILD_RUN_TIMEOUT" : "BUILD_COMMAND_CANCELED",
      message: timedOut ? "构建运行超时" : "构建已取消",
      logs: terminalLog(
        timedOut ? "BUILD_RUN_TIMEOUT" : "BUILD_COMMAND_CANCELED",
        timedOut ? "构建运行超时" : "构建已取消",
        timedOut ? "failed" : "canceled",
      ),
      status: timedOut ? "failed" : "canceled",
      gateSummary: {
        build: { status: "failed" },
        action: timedOut ? "缩短构建耗时后重试。" : "可重新创建 BuildRun。",
      },
    };
  }
  if (error instanceof ReleaseBuildExecutionError) return error.detail;
  if (error instanceof RepositoryGitError) {
    return {
      code: error.detail.code,
      message: error.detail.message,
      logs: terminalLog(error.detail.code, error.detail.message, "failed"),
      gateSummary: {
        source: { status: "failed" },
        action: error.detail.action,
      },
    };
  }
  return {
    code: "BUILD_EXECUTION_FAILED",
    message: "构建执行失败",
    logs: terminalLog(
      "BUILD_EXECUTION_FAILED",
      error instanceof Error ? error.message : String(error),
      "failed",
    ),
    gateSummary: {
      build: { status: "failed" },
      action: "请检查运行证据后重试。",
    },
  };
}

function terminalLog(
  code: string,
  message: string,
  status: "failed" | "canceled",
) {
  return sanitizeBuildLogs([`result ${status}: ${code} ${message}`]);
}
