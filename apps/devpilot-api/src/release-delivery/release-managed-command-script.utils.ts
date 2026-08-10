import type {
  ReleaseStagingWorkload,
  ReleaseWorkloadPaths,
} from "./release-staging-workload.types";
import {
  buildManagedLifecycleCleanupScript,
  buildManagedLifecycleStartScript,
} from "./release-managed-lifecycle-script.utils";
import { buildReleaseWorkloadCommandInvocation } from "./release-workload-command-policy";
import { releaseWorkloadSetupScript } from "./release-workload-script-base.utils";

export function buildManagedCommandStartScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return buildManagedLifecycleStartScript(
    service,
    paths,
    commandBody(service, paths, service.startCommand),
    commandBody(
      service,
      paths,
      service.failureCleanupCommand || "false",
      false,
    ),
  );
}

export function buildManagedCommandStatusScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return commandBody(service, paths, service.statusCommand || "false");
}

export function buildManagedCommandCleanupScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
) {
  return buildManagedLifecycleCleanupScript(service, paths);
}

function commandBody(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
  command: string,
  requireDirectory = true,
) {
  return `${releaseWorkloadSetupScript(service, paths, requireDirectory)}
${buildReleaseWorkloadCommandInvocation(command)}`;
}
