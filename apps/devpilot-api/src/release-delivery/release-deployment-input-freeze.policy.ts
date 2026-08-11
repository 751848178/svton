import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { loadReleaseDeploymentInputState } from "./release-deployment-input-state.repository";
import { buildReleaseDeploymentInputSnapshot } from "./release-deployment-input-snapshot.utils";
import type { ReleaseDeploymentInputSnapshot } from "./release-deployment-input.types";

export async function assertReleaseDeploymentInputCurrent(
  tx: Prisma.TransactionClient,
  input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    providerKey: string;
    snapshot: ReleaseDeploymentInputSnapshot;
  },
) {
  const state = await loadReleaseDeploymentInputState(tx, input);
  const current = buildReleaseDeploymentInputSnapshot(
    state,
    input.providerKey,
    input.snapshot.globalEnvironmentKeys,
    input.snapshot.componentEnvironmentKeys,
  ).snapshot;
  if (current.inputHash !== input.snapshot.inputHash) {
    throw new ConflictException(
      "部署配置、资源或目标已漂移，请重新检查并创建新快照",
    );
  }
}
