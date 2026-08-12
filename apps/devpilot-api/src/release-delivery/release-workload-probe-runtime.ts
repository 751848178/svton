import type {
  ReleaseStagingWorkloadSnapshot,
  ReleaseWorkloadCommandExecutor,
} from "./release-staging-workload.types";
import { componentFilename } from "./local-release-component-environment";
import { buildReleaseWorkloadHealthScript,
  buildReleaseWorkloadStatusScript } from "./release-workload-script.utils";
import { join } from "node:path";

export async function probeReleaseWorkloads(input: {
  snapshot: ReleaseStagingWorkloadSnapshot;
  releaseRoot: string;
  execute: ReleaseWorkloadCommandExecutor;
}) {
  const services: Array<Record<string, unknown>> = [];
  for (const service of input.snapshot.services) {
    const paths = {
      releaseRoot: input.releaseRoot,
      runtimePath: join(input.releaseRoot, ".devpilot", "env",
        componentFilename(service.componentKey)),
    };
    const status = await input.execute(
      buildReleaseWorkloadStatusScript(service, paths),
      service.statusTimeoutMs,
    );
    if (failed(status)) return undefined;
    let httpStatus: number | undefined;
    if (service.health) {
      const health = await input.execute(
        buildReleaseWorkloadHealthScript(service),
        healthBudget(service.health),
      );
      if (failed(health)) return undefined;
      httpStatus = Number(/HTTP_STATUS=(\d{3})/.exec(health.stdout)?.[1] || 0) || undefined;
      if (!httpStatus) return undefined;
    }
    services.push({
      serviceId: service.serviceId,
      processStatus: "running",
      ...(httpStatus ? { httpStatus } : {}),
    });
  }
  const httpChecks = input.snapshot.services.filter((service) => service.health).length;
  return {
    workloadReady: {
      status: "passed",
      inputHash: input.snapshot.inputHash,
      serviceCount: services.length,
      services,
    },
    healthProbe: {
      status: "passed",
      processChecks: services.length,
      httpChecks,
    },
    httpProbe: {
      status: httpChecks > 0 ? "passed" : "not_configured",
      checkedServices: httpChecks,
    },
  };
}

function failed(result: {
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
}) {
  return result.exitCode !== 0 || result.timedOut || result.cancelled;
}

function healthBudget(health: {
  maxAttempts: number;
  timeoutMs: number;
  intervalMs: number;
}) {
  return Math.max(health.timeoutMs * health.maxAttempts +
    health.intervalMs * Math.max(0, health.maxAttempts - 1) + 1_000, 1_000);
}
