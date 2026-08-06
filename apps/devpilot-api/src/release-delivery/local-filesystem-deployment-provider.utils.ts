import { posix } from "node:path";
import { sanitizeBuildLogs } from "./release-build-log.utils";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderError,
} from "./release-deployment-provider.types";

export function localReleaseActivation(
  input: ExactManifestDeploymentInput,
  activatedAt: string,
) {
  return {
    version: 1,
    providerKey: "local-filesystem-v1",
    targetRef: input.targetRef,
    providerDeploymentId: input.deploymentRunId,
    stage: input.stage,
    projectId: input.projectId,
    releaseOrderId: input.releaseOrderId,
    environmentId: input.environmentId,
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.digest,
    buildRunId: input.manifest.buildRunId,
    workloadInputHash: input.workload?.inputHash,
    activatedAt,
  };
}

export function assertLocalReleaseIdentifiers(
  input: ExactManifestDeploymentInput,
) {
  for (const value of [
    input.deploymentRunId,
    input.projectId,
    input.environmentId,
  ]) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw localReleaseFailure(
        "DEPLOYMENT_TARGET_INVALID",
        "Deployment Provider 目标标识无效",
        [],
      );
    }
  }
}

export function isUnsafeReleaseArchiveEntry(entry: string) {
  const value = posix.normalize(entry.replaceAll("\\", "/"));
  return (
    value.startsWith("/") ||
    value === ".." ||
    value.startsWith("../") ||
    value.split("/").includes(".devpilot")
  );
}

export function localReleaseFailure(
  code: string,
  message: string,
  logs: string[],
) {
  return new ReleaseDeploymentProviderError({
    code,
    message,
    logs: sanitizeBuildLogs(logs),
  });
}

export function releaseProviderErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
