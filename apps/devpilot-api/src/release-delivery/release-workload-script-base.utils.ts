import type {
  ReleaseStagingWorkload,
  ReleaseWorkloadPaths,
} from "./release-staging-workload.types";
import { quoteReleaseShell } from "./release-shell-quote.utils";

export { quoteReleaseShell } from "./release-shell-quote.utils";

export function releaseWorkloadSetupScript(
  service: ReleaseStagingWorkload,
  paths: ReleaseWorkloadPaths,
  requireDirectory = true,
) {
  const directory =
    service.workingDirectory === "."
      ? paths.releaseRoot
      : `${paths.releaseRoot}/${service.workingDirectory}`;
  return `set -eu
release=${quoteReleaseShell(paths.releaseRoot)}
runtime=${quoteReleaseShell(paths.runtimePath)}
directory=${quoteReleaseShell(directory)}
${requireDirectory ? 'test -d "$directory"' : '[ -d "$directory" ] || exit 0'}
test -f "$runtime"
set -a
. "$runtime"
set +a
cd "$directory"`;
}

export function releaseWorkloadPath(
  paths: ReleaseWorkloadPaths,
  service: ReleaseStagingWorkload,
  suffix: string,
) {
  return `${paths.releaseRoot}/.devpilot/workloads/${service.serviceId}.${suffix}`;
}

export function releaseEnvironmentRoot(paths: ReleaseWorkloadPaths) {
  return paths.releaseRoot.slice(
    0,
    paths.releaseRoot.lastIndexOf("/releases/"),
  );
}
