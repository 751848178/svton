import { sanitizeBuildLogs } from "./release-build-log.utils";
import {
  ExactManifestDeploymentInput,
  ReleaseDeploymentProviderError,
} from "./release-deployment-provider.types";

export interface SshDeploymentTarget {
  host: string;
  username: string;
  password?: string;
  privateKey?: string;
  root: string;
  targetRef: string;
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
  if (input.targetRef !== target.targetRef || !safeRoot(target.root)) {
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
  paths: { archive: string; release: string; active: string },
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
release_created=0
activated=0
cleanup() {
  rm -rf "$temporary" "$pending" "$archive"
  if [ "$release_created" = 1 ] && [ "$activated" = 0 ]; then rm -rf "$release"; fi
}
trap cleanup EXIT HUP INT TERM
actual="sha256:$(sha256sum "$archive" | awk '{print $1}')"
[ "$actual" = ${quoteSsh(input.manifest.digest)} ] || { echo 'remote Manifest Digest mismatch' >&2; exit 41; }
unzip -t "$archive" >/dev/null
rm -rf "$temporary"
mkdir -p "$temporary"
unzip -qq "$archive" -d "$temporary"
entries="$(find "$temporary" -type f | wc -l)"
[ ! -e "$release" ] || { echo 'provider deployment id already exists' >&2; exit 42; }
mv "$temporary" "$release"
release_created=1
printf '%s\n' ${quoteSsh(receipt)} > "$pending"
mv "$pending" "$active"
activated=1
rm -f "$archive"
trap - EXIT HUP INT TERM
printf 'remoteDigest=%s\nentries=%s\n' "$actual" "$entries"
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

function safeRoot(value: string) {
  return /^\/[A-Za-z0-9_./-]+$/.test(value) && !value.split("/").includes("..");
}
