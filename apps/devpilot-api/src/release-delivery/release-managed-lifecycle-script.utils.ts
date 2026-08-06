import type {
  ReleaseStagingWorkload,
  ReleaseWorkloadPaths,
} from "./release-staging-workload.types";
import {
  quoteReleaseShell,
  releaseEnvironmentRoot,
  releaseWorkloadPath,
} from "./release-workload-script-base.utils";

export function buildManagedLifecycleStartScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
  startBody: string,
  stopBody: string,
) {
  const startFile = releaseWorkloadPath(paths, service, "start");
  const stopFile = releaseWorkloadPath(paths, service, "stop");
  const stoppedFile = releaseWorkloadPath(paths, service, "stopped");
  return `set -eu
mkdir -p ${quoteReleaseShell(`${paths.releaseRoot}/.devpilot/workloads`)}
chmod 700 ${quoteReleaseShell(`${paths.releaseRoot}/.devpilot/workloads`)}
printf '%s\n' ${quoteReleaseShell(`set -eu\nrm -f ${quoteReleaseShell(stoppedFile)}\n${startBody}`)} > ${quoteReleaseShell(startFile)}
printf '%s\n' ${quoteReleaseShell(`set -eu\n[ ! -e ${quoteReleaseShell(stoppedFile)} ] || exit 0\n${stopBody}\n: > ${quoteReleaseShell(stoppedFile)}\nchmod 600 ${quoteReleaseShell(stoppedFile)}`)} > ${quoteReleaseShell(stopFile)}
chmod 700 ${quoteReleaseShell(startFile)} ${quoteReleaseShell(stopFile)}
${stopPrevious(service, paths)}
${quoteReleaseShell(startFile)}
`;
}

export function buildManagedLifecycleCleanupScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  const stopFile = releaseWorkloadPath(paths, service, "stop");
  const restoreFile = releaseWorkloadPath(paths, service, "restore");
  const environmentRoot = releaseEnvironmentRoot(paths);
  return `set -eu
stop_file=${quoteReleaseShell(stopFile)}
[ -x "$stop_file" ] || exit 1
"$stop_file"
restore_file=${quoteReleaseShell(restoreFile)}
if [ -s "$restore_file" ]; then
  previous_start="$(cat "$restore_file")"
  rm -f "$restore_file"
  case "$previous_start" in
    ${quoteReleaseShell(environmentRoot)}/releases/*/.devpilot/workloads/${service.serviceId}.start)
      [ -x "$previous_start" ] && "$previous_start";;
    *) exit 1;;
  esac
fi
`;
}

function stopPrevious(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  const environmentRoot = releaseEnvironmentRoot(paths);
  const restoreFile = releaseWorkloadPath(paths, service, "restore");
  return `environment_root=${quoteReleaseShell(environmentRoot)}
restore_file=${quoteReleaseShell(restoreFile)}
rm -f "$restore_file"
previous="$(sed -n 's/.*"providerDeploymentId"[[:space:]]*:[[:space:]]*"\\([A-Za-z0-9_-]*\\)".*/\\1/p' "$environment_root/active.json" 2>/dev/null | head -n 1)"
if [ -n "$previous" ]; then
  previous_base="$environment_root/releases/$previous/.devpilot/workloads/${service.serviceId}"
  if [ -e "$previous_base.start" ] || [ -e "$previous_base.stop" ]; then
    [ -x "$previous_base.start" ] && [ -x "$previous_base.stop" ] || exit 1
    printf '%s\n' "$previous_base.start" > "$restore_file"
    "$previous_base.stop" || { rm -f "$restore_file"; exit 1; }
  fi
fi`;
}
