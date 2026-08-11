import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { assertGateDecisionCurrent } from "./release-gate-final-validation.repository";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";
import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";
import {
  assertPromotionApproval,
  assertPromotionCandidateState,
  loadPromotionDeployment,
} from "./production-promotion-command-boundary";
import type { ProductionPromotionLease } from "./production-promotion-lease.policy";
import { productionPromotionLeaseTokenHash } from "./production-promotion-lease.policy";
import { promotionProbeHash } from "./production-promotion-observation.repository";

export async function assertProductionPromotionCurrent(
  tx: Prisma.TransactionClient,
  input: {
    commandId: string; lease: ProductionPromotionLease;
    candidate: FrozenProductionCandidate; actorId: string;
    routeSwitchOperationId: string;
    preDecision: ReleaseGateDecisionReference;
    postDecision: ReleaseGateDecisionReference;
  },
) {
  const candidate = input.candidate;
  await tx.$queryRaw`SELECT id FROM ProductionPromotionCommand
    WHERE id = ${input.commandId} FOR UPDATE`;
  const command = await tx.productionPromotionCommand.findFirst({
    where: {
      id: input.commandId, teamId: candidate.teamId,
      projectId: candidate.projectId, releaseOrderId: candidate.releaseOrderId,
      releaseRunId: candidate.releaseRunId,
      deploymentRunId: candidate.deploymentRunId,
      actorId: input.actorId, candidateHash: candidate.candidateHash,
      status: "running", phase: "post_gate_allowed",
      leaseOwner: input.lease.owner,
      leaseTokenHash: productionPromotionLeaseTokenHash(input.lease.token),
      leaseExpiresAt: { gt: new Date() },
      preDecisionId: input.preDecision.id,
      preDecisionInputHash: input.preDecision.inputHash,
      preDecisionActionHash: input.preDecision.actionInputHash,
      postDecisionId: input.postDecision.id,
      postDecisionInputHash: input.postDecision.inputHash,
      postDecisionActionHash: input.postDecision.actionInputHash,
      routeSwitchOperationId: input.routeSwitchOperationId,
    },
  });
  if (!command) throw new ConflictException("Production promotion 最终lease或阶段已漂移");
  const deployment = await loadPromotionDeployment(tx, {
    teamId: candidate.teamId, projectId: candidate.projectId,
    environmentId: candidate.environmentId,
    releaseRunId: candidate.releaseRunId,
    deploymentRunId: candidate.deploymentRunId,
  } as never);
  assertPromotionCandidateState(deployment, candidate);
  await assertPromotionApproval(tx, deployment.releaseRun, candidate);
  const scope = {
    teamId: candidate.teamId, projectId: candidate.projectId,
    releaseOrderId: candidate.releaseOrderId, actorId: input.actorId,
  };
  await assertGateDecisionCurrent(tx, {
    ...scope, checkpoint: "production_promote_pre_route",
    reference: input.preDecision,
    assertActionInput: (action) => assertAction(action, input, false),
  });
  const post = await assertGateDecisionCurrent(tx, {
    ...scope, checkpoint: "production_post_route",
    reference: input.postDecision,
    assertActionInput: (action) => assertAction(action, input, true),
  });
  if (!post.evaluations.some((evaluation) => evaluation.gateId === "P09")) {
    throw new ConflictException("Production P09 决策证据缺失");
  }
  const observation = await tx.siteRouteSwitchRun.findFirst({
    where: {
      operationId: input.routeSwitchOperationId,
      releaseRunId: candidate.releaseRunId,
      deploymentRunId: candidate.deploymentRunId,
      promotionCandidateHash: candidate.candidateHash,
      status: "switched",
      promotionObservedAt: { not: null },
      promotionProbeHash: { not: null },
    },
    select: { promotionProbeHash: true, promotionObservation: true },
  });
  if (!observation?.promotionProbeHash || !observation.promotionObservation ||
    promotionProbeHash(observation.promotionObservation as never) !==
      observation.promotionProbeHash) {
    throw new ConflictException("Production P09 observation 已漂移或未提交");
  }
  await tx.productionPromotionCommand.update({
    where: { id: command.id },
    data: { phase: "committing", heartbeatAt: new Date() },
  });
}

function assertAction(
  action: Record<string, string | null>,
  input: Parameters<typeof assertProductionPromotionCurrent>[1],
  post: boolean,
) {
  const candidate = input.candidate;
  if (action.deploymentRunId !== candidate.deploymentRunId ||
    action.releaseRunId !== candidate.releaseRunId ||
    action.candidateHash !== candidate.candidateHash ||
    action.promotionCommandId !== input.commandId ||
    (!post && action.manifestId !== candidate.manifestId) ||
    (post && action.routeSwitchOperationId !== input.routeSwitchOperationId)) {
    throw new ConflictException("Production promotion gate 动作输入已漂移");
  }
}
