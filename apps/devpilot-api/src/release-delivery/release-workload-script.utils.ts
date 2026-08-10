import type {
  ReleaseStagingWorkload,
  ReleaseWorkloadPaths,
} from "./release-staging-workload.types";
import {
  buildManagedReleaseWorkloadCleanupScript,
  buildManagedReleaseWorkloadDiagnosticScript,
  buildManagedReleaseWorkloadStartScript,
  buildManagedReleaseWorkloadStatusScript,
} from "./release-managed-process-script.utils";
import {
  buildManagedCommandCleanupScript,
  buildManagedCommandStartScript,
  buildManagedCommandStatusScript,
} from "./release-managed-command-script.utils";
import { quoteReleaseShell } from "./release-workload-script-base.utils";

export function buildReleaseWorkloadStartScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  if (service.executionMode === "managed-process-v1") {
    return buildManagedReleaseWorkloadStartScript(service, paths);
  }
  return buildManagedCommandStartScript(service, paths);
}

export function buildReleaseWorkloadStatusScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  if (service.executionMode === "managed-process-v1") {
    return buildManagedReleaseWorkloadStatusScript(service, paths);
  }
  return buildManagedCommandStatusScript(service, paths);
}

export function buildReleaseWorkloadHealthScript(
  service: ReleaseStagingWorkload,
) {
  const health = service.health;
  if (!health) return "true\n";
  const timeoutSeconds = Math.max(1, Math.ceil(health.timeoutMs / 1_000));
  const intervalSeconds = health.intervalMs / 1_000;
  return `set -eu
attempt=1
while [ "$attempt" -le ${health.maxAttempts} ]; do
  code="$(curl -sS -o /dev/null --max-time ${timeoutSeconds} -w '%{http_code}' ${quoteReleaseShell(health.url)} || true)"
  case "$code" in 2??) printf 'HTTP_STATUS=%s\n' "$code"; exit 0;; esac
  attempt=$((attempt + 1))
  [ "$attempt" -le ${health.maxAttempts} ] && sleep ${intervalSeconds}
done
printf 'HTTP_STATUS=%s\n' "$code" >&2
exit 1
`;
}

export function buildReleaseWorkloadCleanupScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  if (service.executionMode === "managed-process-v1") {
    return buildManagedReleaseWorkloadCleanupScript(service, paths);
  }
  return buildManagedCommandCleanupScript(service, paths);
}

export function buildReleaseWorkloadDiagnosticScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return service.executionMode === "managed-process-v1"
    ? buildManagedReleaseWorkloadDiagnosticScript(service, paths)
    : "true\n";
}
