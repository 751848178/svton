import type {
  ReleaseStagingWorkload,
  ReleaseWorkloadPaths,
} from "./release-staging-workload.types";
import {
  buildManagedLifecycleCleanupScript,
  buildManagedLifecycleStartScript,
} from "./release-managed-lifecycle-script.utils";
import {
  buildReleaseProcessGroupRunningCheck,
  buildReleaseProcessGroupStopScript,
} from "./release-managed-process-stop-script.utils";
import { buildReleaseWorkloadCommandInvocation } from "./release-workload-command-policy";
import {
  quoteReleaseShell,
  releaseWorkloadPath,
  releaseWorkloadSetupScript,
} from "./release-workload-script-base.utils";

export function buildManagedReleaseWorkloadStartScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return buildManagedLifecycleStartScript(
    service,
    paths,
    managedStartBody(service, paths),
    managedStopBody(service, paths),
    managedPreviousStopRecovery(),
  );
}

export function buildManagedReleaseWorkloadStatusScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return `set -eu
pid_file=${quoteReleaseShell(releaseWorkloadPath(paths, service, "pid"))}
test -s "$pid_file"
pid="$(cat "$pid_file")"
case "$pid" in ''|*[!0-9]*) exit 1;; esac
${buildReleaseProcessGroupRunningCheck("pid")}
release_process_group_is_running
printf 'PROCESS_STATUS=running\n'
`;
}

function managedPreviousStopRecovery() {
  return `release_previous_process_stop() {
  previous_pid_file="$previous_base.pid"
  [ -s "$previous_pid_file" ] || return 1
  previous_pid="$(cat "$previous_pid_file")"
  ${buildReleaseProcessGroupStopScript("previous_pid", "return 1")}
  rm -f "$previous_pid_file"
}
if ! release_previous_process_stop; then
  rm -f "$restore_file"
  exit 1
fi`;
}

export function buildManagedReleaseWorkloadCleanupScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return buildManagedLifecycleCleanupScript(service, paths);
}

export function buildManagedReleaseWorkloadDiagnosticScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return `set +e
log=${quoteReleaseShell(releaseWorkloadPath(paths, service, "log"))}
[ -f "$log" ] && tail -n 40 "$log" || true
`;
}

function managedStartBody(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return `${releaseWorkloadSetupScript(service, paths)}
log=${quoteReleaseShell(releaseWorkloadPath(paths, service, "log"))}
pid_file=${quoteReleaseShell(releaseWorkloadPath(paths, service, "pid"))}
: > "$log"
command -v setsid >/dev/null
nohup setsid ${buildReleaseWorkloadCommandInvocation(service.startCommand)} >>"$log" 2>&1 </dev/null &
pid=$!
printf '%s\n' "$pid" > "$pid_file"
sleep 1
${buildReleaseProcessGroupRunningCheck("pid")}
release_process_group_is_running`;
}

function managedStopBody(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return `pid_file=${quoteReleaseShell(releaseWorkloadPath(paths, service, "pid"))}
if [ -s "$pid_file" ]; then
  pid="$(cat "$pid_file")"
  ${buildReleaseProcessGroupStopScript("pid")}
  rm -f "$pid_file"
fi`;
}
