import { ReleaseDeploymentProviderError } from "./release-deployment-provider.types";
import type {
  ReleaseStagingWorkload,
  ReleaseStagingWorkloadHealth,
  ReleaseStagingWorkloadSnapshot,
  ReleaseWorkloadCommandExecutor,
} from "./release-staging-workload.types";
import {
  buildReleaseWorkloadHealthScript,
  buildReleaseWorkloadStartScript,
  buildReleaseWorkloadStatusScript,
} from "./release-workload-script.utils";
import {
  cleanupReleaseWorkloads,
  collectReleaseWorkloadDiagnostics,
} from "./release-workload-cleanup-runtime";
import { sanitizeReleaseWorkloadLogs } from "./release-workload-log-sanitizer";
import { assertSafeReleaseWorkloadEnvironment } from "./release-workload-environment-policy";

export { cleanupReleaseWorkloads } from "./release-workload-cleanup-runtime";

interface RuntimeInput {
  snapshot: ReleaseStagingWorkloadSnapshot;
  releaseRoot: string;
  runtimePath: string;
  runtimeEnvironment: Record<string, string>;
  execute: ReleaseWorkloadCommandExecutor;
}

export async function runReleaseWorkloads(input: RuntimeInput) {
  assertSafeReleaseWorkloadEnvironment(input.runtimeEnvironment);
  const ready: Array<Record<string, unknown>> = [];
  const started: ReleaseStagingWorkload[] = [];
  const logs: string[] = [];
  try {
    for (const service of input.snapshot.services) {
      started.push(service);
      await requireCommand(
        input,
        service,
        "WORKLOAD_START_FAILED",
        buildReleaseWorkloadStartScript(service, input),
        service.startTimeoutMs,
      );
      await requireCommand(
        input,
        service,
        "WORKLOAD_STATUS_FAILED",
        buildReleaseWorkloadStatusScript(service, input),
        service.statusTimeoutMs,
      );
      const health = service.health
        ? await requireCommand(
            input,
            service,
            "WORKLOAD_HEALTH_FAILED",
            buildReleaseWorkloadHealthScript(service),
            healthBudget(service.health),
          )
        : undefined;
      const httpStatus = health
        ? Number(/HTTP_STATUS=(\d{3})/.exec(health.stdout)?.[1] || 0)
        : undefined;
      ready.push({
        serviceId: service.serviceId,
        componentKey: service.componentKey,
        kind: service.kind,
        artifactDigest: service.artifactDigest,
        executionMode: service.executionMode,
        processStatus: "running",
        httpStatus: httpStatus || undefined,
      });
      logs.push(
        `workload ${service.serviceId} started and process status passed`,
      );
      if (httpStatus) {
        logs.push(
          `workload ${service.serviceId} HTTP probe passed (${httpStatus})`,
        );
      }
    }
  } catch (error) {
    const diagnosticLogs = await collectReleaseWorkloadDiagnostics(
      input,
      started,
    );
    const cleanupLogs = await cleanupReleaseWorkloads(input, started);
    if (error instanceof ReleaseDeploymentProviderError) {
      throw failure(
        error.detail.code,
        error.detail.message,
        input,
        [...error.detail.logs, ...diagnosticLogs, ...cleanupLogs],
        true,
      );
    }
    throw failure(
      "WORKLOAD_RUNTIME_FAILED",
      "工作负载运行失败",
      input,
      [
        error instanceof Error ? error.message : String(error),
        ...diagnosticLogs,
        ...cleanupLogs,
      ],
      true,
    );
  }
  const httpCount = input.snapshot.services.filter(
    (item) => item.health,
  ).length;
  return {
    logs: sanitizeReleaseWorkloadLogs(logs, input.runtimeEnvironment),
    evidence: {
      workloadReady: {
        status: "passed",
        inputHash: input.snapshot.inputHash,
        serviceCount: ready.length,
        services: ready,
      },
      healthProbe: {
        status: "passed",
        processChecks: ready.length,
        httpChecks: httpCount,
      },
      httpProbe: {
        status: httpCount > 0 ? "passed" : "not_configured",
        checkedServices: httpCount,
      },
    },
  };
}

async function requireCommand(
  input: RuntimeInput,
  service: ReleaseStagingWorkload,
  code: string,
  script: string,
  timeoutMs: number,
) {
  const result = await input.execute(script, timeoutMs);
  if (result.exitCode !== 0 || result.timedOut || result.cancelled) {
    throw failure(code, `服务 ${service.name} 启动或探针失败`, input, [
      `workload ${service.serviceId} ${code} exit=${result.exitCode ?? "none"} timeout=${result.timedOut} cancelled=${result.cancelled}`,
      result.stderr,
      result.stdout,
    ]);
  }
  return result;
}

function failure(
  code: string,
  messageText: string,
  input: RuntimeInput,
  logs: string[],
  workloadCleanupAttempted = false,
) {
  return new ReleaseDeploymentProviderError({
    code,
    message: messageText,
    logs: sanitizeReleaseWorkloadLogs(logs, input.runtimeEnvironment),
    ...(workloadCleanupAttempted ? { workloadCleanupAttempted: true } : {}),
  });
}

function healthBudget(health: ReleaseStagingWorkloadHealth) {
  return (
    health.maxAttempts * health.timeoutMs +
    Math.max(0, health.maxAttempts - 1) * health.intervalMs +
    1_000
  );
}
