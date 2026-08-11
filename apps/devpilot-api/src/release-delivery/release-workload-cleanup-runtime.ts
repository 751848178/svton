import type {
  ReleaseStagingWorkload,
  ReleaseWorkloadCommandExecutor,
} from "./release-staging-workload.types";
import { sanitizeReleaseWorkloadLogs } from "./release-workload-log-sanitizer";
import {
  buildReleaseWorkloadCleanupScript,
  buildReleaseWorkloadDiagnosticScript,
} from "./release-workload-script.utils";
import {
  type ReleaseComponentEnvironments,
  releaseEnvironmentSecrets,
  releaseWorkloadPaths,
} from "./release-component-environment";

interface CleanupRuntimeInput extends ReleaseComponentEnvironments {
  releaseRoot: string;
  execute: ReleaseWorkloadCommandExecutor;
  snapshot: { services: ReleaseStagingWorkload[] };
}

export async function cleanupReleaseWorkloads(
  input: CleanupRuntimeInput,
  services = input.snapshot.services,
) {
  const failures: string[] = [];
  for (const service of [...services].reverse()) {
    const result = await input
      .execute(
        buildReleaseWorkloadCleanupScript(
          service,
          releaseWorkloadPaths(input, service),
        ),
        service.statusTimeoutMs,
      )
      .catch((error) => {
        failures.push(
          `workload ${service.serviceId} cleanup executor failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      });
    if (
      result &&
      (result.exitCode !== 0 || result.timedOut || result.cancelled)
    ) {
      failures.push(
        `workload ${service.serviceId} cleanup failed exit=${result.exitCode ?? "none"} timeout=${result.timedOut} cancelled=${result.cancelled}`,
        result.stderr,
        result.stdout,
      );
    }
  }
  return sanitizeReleaseWorkloadLogs(failures, releaseEnvironmentSecrets(input));
}

export async function collectReleaseWorkloadDiagnostics(
  input: CleanupRuntimeInput,
  services: ReleaseStagingWorkload[],
) {
  const lines: string[] = [];
  for (const service of services) {
    const result = await input
      .execute(
        buildReleaseWorkloadDiagnosticScript(
          service,
          releaseWorkloadPaths(input, service),
        ),
        service.statusTimeoutMs,
      )
      .catch(() => undefined);
    if (result?.stdout) {
      lines.push(`workload ${service.serviceId}: ${result.stdout}`);
    }
  }
  return sanitizeReleaseWorkloadLogs(lines, releaseEnvironmentSecrets(input));
}
