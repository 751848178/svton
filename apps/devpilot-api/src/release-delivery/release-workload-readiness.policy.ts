import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

export function workloadReadinessConfigured(
  workload: ReleaseStagingWorkloadSnapshot,
) {
  return workload.services.every((service) =>
    service.executionMode === "managed-command-v1"
      ? Boolean(service.statusCommand)
      : Boolean(service.health),
  );
}
