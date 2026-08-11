import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  assertPromotionCommandReplay,
  exactFrozenCandidate,
  promotionCommandInputHash,
} from "./production-promotion-command.policy";
import type {
  ProductionPromotionResumeInput,
  ReservedProductionPromotionCommand,
} from "./production-promotion-command.types";
import {
  assertPromotionApproval,
  assertPromotionCandidateState,
  loadPromotionDeployment,
  lockProductionPromotionRuns,
} from "./production-promotion-command-boundary";

@Injectable()
export class ProductionPromotionCommandRepository {
  constructor(private readonly prisma: PrismaService) {}

  reserve(input: ProductionPromotionResumeInput) {
    return this.prisma.$transaction(async (tx) => {
      await lockProductionPromotionRuns(tx, input);
      const deployment = await loadPromotionDeployment(tx, input);
      const candidate = exactFrozenCandidate(deployment.result, input);
      const inputHash = promotionCommandInputHash(input);
      const existing = await tx.productionPromotionCommand.findUnique({
        where: { deploymentRunId_idempotencyKey: {
          deploymentRunId: input.deploymentRunId,
          idempotencyKey: input.idempotencyKey,
        } },
      });
      if (existing) {
        assertPromotionCommandReplay(existing, inputHash);
        return reserved(existing, deployment, candidate, true);
      }
      assertPromotionCandidateState(deployment, candidate);
      await assertPromotionApproval(tx, deployment.releaseRun, candidate);
      const active = await tx.productionPromotionCommand.findFirst({
        where: { deploymentRunId: input.deploymentRunId, status: "running" },
        select: { id: true },
      });
      if (active) {
        throw new ConflictException("Production promotion 已有执行中的命令");
      }
      const command = await tx.productionPromotionCommand.create({
        data: {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: candidate.releaseOrderId,
          releaseRunId: input.releaseRunId,
          deploymentRunId: input.deploymentRunId,
          actorId: input.actorId,
          idempotencyKey: input.idempotencyKey,
          candidateHash: input.candidateHash,
          inputHash,
        },
      });
      return reserved(command, deployment, candidate, false);
    });
  }

  finish(input: {
    commandId: string;
    status: "completed" | "failed" | "blocked";
    result?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  }) {
    return this.prisma.productionPromotionCommand.updateMany({
      where: { id: input.commandId, status: "running" },
      data: {
        status: input.status,
        result: input.result as Prisma.InputJsonValue | undefined,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        finishedAt: new Date(),
      },
    });
  }
}

function reserved(
  command: { id: string; status: string; inputHash: string; result: unknown; errorCode: string | null; errorMessage: string | null },
  deployment: Awaited<ReturnType<typeof loadPromotionDeployment>>,
  candidate: ReturnType<typeof exactFrozenCandidate>,
  idempotentReplay: boolean,
): ReservedProductionPromotionCommand {
  return { command, candidate, routeSnapshot: deployment.releaseRun.routeSnapshot,
    deploymentResult: deployment.result, deploymentLogs: deployment.logs, idempotentReplay };
}
