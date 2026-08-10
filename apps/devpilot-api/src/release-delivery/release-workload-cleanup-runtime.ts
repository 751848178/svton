import type {
  ReleaseStagingWorkload,
  ReleaseWorkloadCommandExecutor,
} from "./release-staging-workload.types";
import { sanitizeReleaseWorkloadLogs } from "./release-workload-log-sanitizer";
import {
  buildReleaseWorkloadCleanupScript,
  buildReleaseWorkloadDiagnosticScript,
} from "./release-workload-script.utils";

interface CleanupRuntimeInput {
  releaseRoot: string;
  runtimePath: string;
  runtimeEnvironment: Record<string, string>;
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
        buildReleaseWorkloadCleanupScript(service, input),
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
  return sanitizeReleaseWorkloadLogs(failures, input.runtimeEnvironment);
}

export async function collectReleaseWorkloadDiagnostics(
  input: CleanupRuntimeInput,
  services: ReleaseStagingWorkload[],
) {
  const lines: string[] = [];
  for (const service of services) {
    const result = await input
      .execute(
        buildReleaseWorkloadDiagnosticScript(service, input),
        service.statusTimeoutMs,
      )
      .catch(() => undefined);
    if (result?.stdout) {
      lines.push(`workload ${service.serviceId}: ${result.stdout}`);
    }
  }
  return sanitizeReleaseWorkloadLogs(lines, input.runtimeEnvironment);
}
