import { sanitizeBuildLogs } from "./release-build-log.utils";
import { ReleaseStagingExecutionError } from "./release-staging.types";

export function stagingFailureDetail(error: unknown) {
  if (error instanceof ReleaseStagingExecutionError) return error.detail;
  return {
    code: "STAGING_DEPLOYMENT_FAILED",
    message: "Staging 制品部署失败",
    logs: sanitizeBuildLogs([
      error instanceof Error ? error.message : String(error),
    ]),
  };
}

export function scopedStagingDeployment<T>(
  item: T,
  projectId: string,
  releaseOrderId: string,
) {
  return { ...item, projectId, releaseOrderId };
}
