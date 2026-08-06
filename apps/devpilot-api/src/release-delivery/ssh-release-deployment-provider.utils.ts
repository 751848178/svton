import { sanitizeBuildLogs } from "./release-build-log.utils";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderError,
} from "./release-deployment-provider.types";
import {
  isSafeReleaseDeploymentSshRoot,
  releaseDeploymentSshTargetRef,
} from "./release-deployment-ssh-target.utils";
export { quoteReleaseShell as quoteSsh } from "./release-shell-quote.utils";

export interface SshDeploymentTarget {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  root: string;
  targetRef: string;
}

export function resolveSshDeploymentTarget(
  input: ExactManifestDeploymentInput,
  configured: SshDeploymentTarget,
): SshDeploymentTarget {
  const connection = input.targetConnection;
  if (!connection) return configured;
  const targetRef = releaseDeploymentSshTargetRef(connection);
  return {
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password:
      connection.authType === "password" ? connection.credential : undefined,
    privateKey:
      connection.authType === "key" ? connection.credential : undefined,
    root: connection.root,
    targetRef,
  };
}

export function assertSshDeploymentInput(
  input: ExactManifestDeploymentInput,
  target: SshDeploymentTarget,
) {
  if (
    !target.host ||
    !target.username ||
    (!target.password && !target.privateKey)
  ) {
    throw sshProviderFailure(
      "DEPLOYMENT_TARGET_UNCONFIGURED",
      "SSH Deployment Provider 目标或凭据未配置",
      [],
    );
  }
  if (
    input.targetRef !== target.targetRef ||
    !isSafeReleaseDeploymentSshRoot(target.root)
  ) {
    throw sshProviderFailure(
      "DEPLOYMENT_TARGET_MISMATCH",
      "SSH Deployment Provider 目标引用无效",
      [],
    );
  }
  for (const value of [
    input.deploymentRunId,
    input.projectId,
    input.environmentId,
  ]) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw sshProviderFailure(
        "DEPLOYMENT_TARGET_INVALID",
        "SSH Deployment Provider 目标标识无效",
        [],
      );
    }
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(input.manifest.digest)) {
    throw sshProviderFailure(
      "DEPLOYMENT_MANIFEST_DIGEST_INVALID",
      "Manifest Digest 格式无效",
      [],
    );
  }
}

export async function requireSuccessfulSsh(
  promise: Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    cancelled: boolean;
  }>,
  code: string,
) {
  const result = await promise;
  if (result.exitCode !== 0 || result.timedOut || result.cancelled) {
    throw sshProviderFailure(code, "SSH Deployment Provider 目标命令失败", [
      result.stderr,
      result.stdout,
    ]);
  }
  return result;
}

export function sshProviderFailure(
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

export function sshProviderErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function mergeSshProviderFailure(error: unknown, cleanupLogs: string[]) {
  if (error instanceof ReleaseDeploymentProviderError) {
    if (cleanupLogs.length === 0) return error;
    return sshProviderFailure(error.detail.code, error.detail.message, [
      ...error.detail.logs,
      ...cleanupLogs,
    ]);
  }
  return sshProviderFailure(
    "DEPLOYMENT_PROVIDER_FAILED",
    "SSH Deployment Provider 执行失败",
    [sshProviderErrorMessage(error), ...cleanupLogs],
  );
}
