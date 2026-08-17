import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";

@Injectable()
export class ProductionPromotionAwaitingRepository {
  constructor(private readonly prisma: PrismaService) {}

  wait(input: {
    candidate: FrozenProductionCandidate;
    actorId: string;
    logs: string[];
    result: Record<string, unknown>;
    postDecision: ReleaseGateDecisionReference;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = input.candidate;
      await lockRuns(tx, candidate.deploymentRunId, candidate.releaseRunId);
      const release = await tx.releaseRun.findFirst({
        where: {
          id: candidate.releaseRunId,
          teamId: candidate.teamId,
          projectId: candidate.projectId,
          releaseOrderId: candidate.releaseOrderId,
          environmentId: candidate.environmentId,
          artifactManifestId: candidate.manifestId,
          status: "running",
        },
        select: { id: true },
      });
      if (!release) throw new ConflictException("Production ReleaseRun 不可进入验证等待态");
      const deployment = await tx.deploymentRun.updateMany({
        where: {
          id: candidate.deploymentRunId,
          releaseRunId: candidate.releaseRunId,
          artifactManifestId: candidate.manifestId,
          environmentId: candidate.environmentId,
          status: "running",
        },
        data: {
          status: "awaiting_validation",
          logs: input.logs,
          result: {
            ...input.result,
            productionCandidate: candidate,
            promotionStatus: "awaiting_validation",
            postDeployGateDecision: input.postDecision,
          } as Prisma.InputJsonValue,
        },
      });
      if (deployment.count !== 1) {
        throw new ConflictException("Production DeploymentRun 不可进入验证等待态");
      }
      const transitioned = await tx.releaseRun.updateMany({
        where: { id: candidate.releaseRunId, status: "running" },
        data: { status: "awaiting_validation" },
      });
      if (transitioned.count !== 1) {
        throw new ConflictException("Production ReleaseRun 状态已变化");
      }
      await claimReleaseGateDecision(tx, {
        teamId: candidate.teamId,
        projectId: candidate.projectId,
        releaseOrderId: candidate.releaseOrderId,
        actorId: input.actorId,
        decisionId: input.postDecision.id,
        stage: input.postDecision.stage,
        inputHash: input.postDecision.inputHash,
        actionRunType: "deployment_run",
        actionRunId: candidate.deploymentRunId,
        requireAllowed: true,
      });
      return tx.deploymentRun.findUniqueOrThrow({
        where: { id: candidate.deploymentRunId },
        include: { environmentVersion: true },
      });
    });
  }
}

async function lockRuns(
  tx: Prisma.TransactionClient,
  deploymentRunId: string,
  releaseRunId: string,
) {
  await tx.$queryRaw`SELECT id FROM DeploymentRun WHERE id = ${deploymentRunId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM ReleaseRun WHERE id = ${releaseRunId} FOR UPDATE`;
}
