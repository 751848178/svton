import type { Prisma } from "@prisma/client";
import { ConflictException } from "@nestjs/common";
import type { ReleaseBuildInputSnapshot } from "./release-build.types";
import { assertGateDecisionCurrent } from "./release-gate-final-validation.repository";

export async function assertBuildGateDecisionCurrent(
  tx: Prisma.TransactionClient,
  input: {
    teamId: string; projectId: string; releaseOrderId: string; actorId: string;
    snapshot: ReleaseBuildInputSnapshot;
  },
) {
  const reference = input.snapshot.gateDecision;
  if (!reference) throw new ConflictException("BuildRun 缺少 build_pre 门禁决定");
  await assertGateDecisionCurrent(tx, {
    ...input,
    checkpoint: "build_pre_execution",
    reference,
    assertActionInput(action) {
      if (action.repositoryIdentityRevisionId !==
        input.snapshot.repositoryIdentity.revisionId ||
        action.sourceBranch !== input.snapshot.sourceBranch ||
        action.sourceCommitSha !== input.snapshot.sourceCommitSha) {
        throw new ConflictException("build_pre 来源修订或 Commit 已漂移");
      }
    },
  });
}
