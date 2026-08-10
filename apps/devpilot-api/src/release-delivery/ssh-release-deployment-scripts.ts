import type { ExactManifestDeploymentInput } from "./release-deployment-provider.types";
import { quoteSsh } from "./ssh-release-deployment-provider.utils";

interface MaterializationPaths {
  archive: string;
  runtimes: Record<string, string>;
  release: string;
}

export function buildSshMaterializationScript(
  input: ExactManifestDeploymentInput,
  paths: MaterializationPaths,
) {
  const temporary = `${paths.release}.tmp`;
  const runtimeFiles = Object.entries(paths.runtimes);
  const cleanupRuntimes = runtimeFiles.map(([, path]) => quoteSsh(path)).join(" ");
  const validateRuntimes = runtimeFiles.map(([, path]) =>
    `[ "$(stat -c '%a' ${quoteSsh(path)})" = 600 ] || { echo 'runtime input mode invalid' >&2; exit 43; }`,
  ).join("\n");
  const moveRuntimes = runtimeFiles.map(([componentKey, path]) =>
    `mv ${quoteSsh(path)} ${quoteSsh(`${temporary}/.devpilot/env/${componentKey}.env`)}\nchmod 600 ${quoteSsh(`${temporary}/.devpilot/env/${componentKey}.env`)}`,
  ).join("\n");
  return `set -eu
archive=${quoteSsh(paths.archive)}
release=${quoteSsh(paths.release)}
temporary=${quoteSsh(temporary)}
completed=0
cleanup() {
  rm -rf "$temporary" "$archive" ${cleanupRuntimes}
  if [ "$completed" = 0 ]; then rm -rf "$release"; fi
}
trap cleanup EXIT HUP INT TERM
actual="sha256:$(sha256sum "$archive" | awk '{print $1}')"
[ "$actual" = ${quoteSsh(input.manifest.digest)} ] || { echo 'remote Manifest Digest mismatch' >&2; exit 41; }
${validateRuntimes}
unzip -t "$archive" >/dev/null
rm -rf "$temporary"
mkdir -p "$temporary"
unzip -qq "$archive" -d "$temporary"
rm -rf "$temporary/.devpilot"
mkdir -m 700 "$temporary/.devpilot" "$temporary/.devpilot/env"
${moveRuntimes}
entries="$(find "$temporary" -type f | wc -l)"
[ ! -e "$release" ] || { echo 'provider deployment id already exists' >&2; exit 42; }
mv "$temporary" "$release"
completed=1
rm -f "$archive"
trap - EXIT HUP INT TERM
printf 'remoteDigest=%s\nentries=%s\nruntimeMode=600\n' "$actual" "$entries"
`;
}

export function buildSshPublishScript(
  input: ExactManifestDeploymentInput,
  paths: { active: string },
  activatedAt: string,
) {
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
    workloadInputHash: input.workload?.inputHash,
    activatedAt,
  });
  return `set -eu
active=${quoteSsh(paths.active)}
pending=${quoteSsh(pending)}
cleanup() { rm -f "$pending"; }
trap cleanup EXIT HUP INT TERM
printf '%s\n' ${quoteSsh(receipt)} > "$pending"
chmod 600 "$pending"
mv "$pending" "$active"
trap - EXIT HUP INT TERM
printf 'PUBLISHED=1\n'
`;
}
