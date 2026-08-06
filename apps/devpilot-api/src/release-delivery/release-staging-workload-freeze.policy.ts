import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { buildReleaseStagingWorkloadSnapshot } from "./release-staging-workload-snapshot.utils";
import { loadReleaseStagingWorkloadState } from "./release-staging-workload-state.repository";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";

export async function assertReleaseStagingWorkloadCurrent(
  tx: Prisma.TransactionClient,
  input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    manifestId: string;
    snapshot: ReleaseStagingWorkloadSnapshot;
  },
) {
  try {
    const current = buildReleaseStagingWorkloadSnapshot(
      await loadReleaseStagingWorkloadState(tx, input),
    );
    if (current.inputHash === input.snapshot.inputHash) return;
  } catch {
    // Normalize missing or invalid current state into one retryable drift result.
  }
  throw new ConflictException("Staging 工作负载或 Manifest 已漂移，请重新部署");
}
