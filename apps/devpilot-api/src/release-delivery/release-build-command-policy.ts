import type { ReleaseBuildCommandOutcome } from "./release-build-command-runner";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { sanitizeBuildLogs } from "./release-build-log.utils";

export function controlledBuildEnvironment(
  path: string,
  home: string,
  temporary: string,
  declared: Record<string, string> = {},
) {
  return {
    PATH: path,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    CI: "true",
    HOME: home,
    TMPDIR: temporary,
    ...declared,
  };
}

export function assertControlledBuildCommand(
  name: string,
  result: ReleaseBuildCommandOutcome,
  logs: string[],
) {
  if (result.kind === "timed_out") {
    throw commandFailure(
      "BUILD_COMMAND_TIMEOUT",
      `${name} 构建超时`,
      logs,
      "调整构建后重试。",
    );
  }
  if (result.kind === "canceled") {
    throw commandFailure(
      "BUILD_COMMAND_CANCELED",
      `${name} 构建已取消`,
      logs,
      "可重新创建 BuildRun。",
      "canceled",
    );
  }
  if (result.kind === "output_limited") {
    throw commandFailure(
      "BUILD_COMMAND_OUTPUT_LIMIT",
      `${name} 构建日志超过上限`,
      logs,
      "减少命令输出后重试。",
    );
  }
  if (result.kind === "spawn_failed" || result.exitCode !== 0) {
    throw commandFailure(
      "BUILD_COMMAND_FAILED",
      `${name} 构建失败（exit ${result.exitCode}）`,
      logs,
      "修复构建命令后重试。",
    );
  }
}

function commandFailure(
  code: string,
  message: string,
  logs: string[],
  action: string,
  status: "failed" | "canceled" = "failed",
) {
  return new ReleaseBuildExecutionError({
    code,
    message,
    logs: sanitizeBuildLogs(logs),
    gateSummary: { build: { status: "failed" }, action },
    status,
  });
}
