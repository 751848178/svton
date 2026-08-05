import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseStagingExecutionError } from "./release-staging.types";

export function environmentDeploymentFailureDetail(error: unknown) {
  if (error instanceof ReleaseStagingExecutionError) return error.detail;
  return {
    code: "ENVIRONMENT_DEPLOYMENT_FAILED",
    message: "环境制品部署失败",
    logs: sanitizeBuildLogs([
      error instanceof Error ? error.message : String(error),
    ]),
  };
}
