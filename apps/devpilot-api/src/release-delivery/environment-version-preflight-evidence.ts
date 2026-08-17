import type { ReleaseProductionDnsProbeService } from "./release-production-dns-probe.service";
import type { ReleaseServerCapacityService } from "./release-server-capacity.service";
import type { PreparedReleaseDeploymentInput } from "./release-deployment-input.types";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

export async function collectEnvironmentVersionPreflightEvidence(
  deps: {
    capacity?: ReleaseServerCapacityService;
    dns?: ReleaseProductionDnsProbeService;
  },
  input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    configRevisionId: string;
    buildRunId: string;
    manifestId: string;
    providerKey: string;
    deployment: PreparedReleaseDeploymentInput;
    workload: ReleaseStagingWorkloadSnapshot;
  },
) {
  const capacity = await deps.capacity?.collect({
    ...input,
    deployment: input.deployment,
    workload: input.workload,
  });
  const dns = await deps.dns?.collect({
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    configRevisionId: input.configRevisionId,
    routeSnapshot: input.deployment.snapshot.routeSnapshot,
    deploymentInputHash: input.deployment.snapshot.inputHash,
    workloadInputHash: input.workload.inputHash,
    providerKey: input.providerKey,
  });
  return {
    capacitySnapshotId: capacity?.id,
    capacitySnapshotHash: capacity?.measurementHash,
    dnsProbeReceiptId: dns?.id,
    dnsProbeResultHash: dns?.resultHash,
  };
}
