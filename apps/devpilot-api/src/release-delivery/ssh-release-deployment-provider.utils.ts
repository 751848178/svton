import { sanitizeBuildLogs } from "./release-build-log.utils";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderError,
} from "./release-deployment-provider.types";
import {
  isSafeReleaseDeploymentSshRoot,
  releaseDeploymentSshTargetRef,
} from "./release-deployment-ssh-target.utils";

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

export function buildSshActivationScript(
  input: ExactManifestDeploymentInput,
  paths: { archive: string; runtime: string; release: string; active: string },
) {
  const temporary = `${paths.release}.tmp`;
  const pending = `${paths.active}.${input.deploymentRunId}.tmp`;
  const receipt = JSON.stringify({
    version: 1,
    providerKey: "ssh-v1",
    providerDeploymentId: input.deploymentRunId,
    stage: input.stage,
    targetRef: input.targetRef,
    projectId: input.projectId,
    releaseOrderId: input.releaseOrderId,
    environmentId: input.environmentId,
    manifestId: input.manifest.id,
    manifestDigest: input.manifest.digest,
    buildRunId: input.manifest.buildRunId,
  });
  return `set -eu
archive=${quoteSsh(paths.archive)}
release=${quoteSsh(paths.release)}
temporary=${quoteSsh(temporary)}
active=${quoteSsh(paths.active)}
pending=${quoteSsh(pending)}
runtime=${quoteSsh(paths.runtime)}
release_created=0
activated=0
cleanup() {
  rm -rf "$temporary" "$pending" "$archive" "$runtime"
  if [ "$release_created" = 1 ] && [ "$activated" = 0 ]; then rm -rf "$release"; fi
}
trap cleanup EXIT HUP INT TERM
actual="sha256:$(sha256sum "$archive" | awk '{print $1}')"
[ "$actual" = ${quoteSsh(input.manifest.digest)} ] || { echo 'remote Manifest Digest mismatch' >&2; exit 41; }
runtime_mode="$(stat -c '%a' "$runtime")"
[ "$runtime_mode" = 600 ] || { echo 'runtime input mode invalid' >&2; exit 43; }
unzip -t "$archive" >/dev/null
rm -rf "$temporary"
mkdir -p "$temporary"
unzip -qq "$archive" -d "$temporary"
mkdir -p "$temporary/.devpilot"
mv "$runtime" "$temporary/.devpilot/runtime.env"
chmod 600 "$temporary/.devpilot/runtime.env"
entries="$(find "$temporary" -type f | wc -l)"
[ ! -e "$release" ] || { echo 'provider deployment id already exists' >&2; exit 42; }
mv "$temporary" "$release"
release_created=1
printf '%s\n' ${quoteSsh(receipt)} > "$pending"
mv "$pending" "$active"
activated=1
rm -f "$archive"
trap - EXIT HUP INT TERM
printf 'remoteDigest=%s\nentries=%s\nruntimeMode=%s\n' "$actual" "$entries" "$runtime_mode"
`;
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

export function quoteSsh(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
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
