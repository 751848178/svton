import { ReleaseBuildExecutionError } from "./release-build-execution.error";
import { sanitizeBuildLogs } from "./release-build-log.utils";

export function releaseBuildExecutionFailure(
  code: string,
  message: string,
  logs: string[],
  action: string,
  status: "failed" | "canceled" = "failed",
) {
  return new ReleaseBuildExecutionError({
    code,
    message,
    logs: sanitizeBuildLogs([
      ...logs,
      `result ${status === "canceled" ? "canceled" : "failed"}: ${code} ${message}`,
    ]),
    gateSummary: { build: { status: "failed" }, action },
    status,
  });
}
