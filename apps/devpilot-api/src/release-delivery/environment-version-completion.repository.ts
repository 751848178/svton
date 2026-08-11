import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SiteRouteSwitchSagaRepository } from "../site/site-route-switch-saga.repository";
import type { SiteRouteSwitchAttemptPersistence } from "../site/site-route-switch.types";
import { completeVersionedDeployment } from "./environment-version-write.utils";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";
import { completeProductionPromotionCommand } from "./production-promotion-command-completion.repository";
import type { FrozenProductionCandidate } from "./production-promotion-candidate.policy";
import type { ProductionPromotionLease } from "./production-promotion-lease.policy";
import { assertProductionPromotionCurrent } from "./production-promotion-final-validation.repository";

@Injectable()
export class EnvironmentVersionCompletionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routeSaga: SiteRouteSwitchSagaRepository,
  ) {}

  complete(
    input: Parameters<typeof completeVersionedDeployment>[1] & {
      teamId: string;
      projectId: string;
      releaseOrderId: string;
      actorId: string;
      gateDecision?: ReleaseGateDecisionReference;
      gateDecisions?: ReleaseGateDecisionReference[];
      routeSwitchAttempt?: SiteRouteSwitchAttemptPersistence;
      routeSwitchOperationId?: string;
      promotionCommand?: {
        id: string;
        candidateHash: string;
        result?: Record<string, unknown>;
        errorCode?: string;
        errorMessage?: string;
      };
      promotionLease?: ProductionPromotionLease;
      productionCandidate?: FrozenProductionCandidate;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const decisions = input.gateDecisions ??
        (input.gateDecision ? [input.gateDecision] : []);
      if (input.status === "completed" && input.promotionCommand) {
        if (!input.promotionLease || !input.productionCandidate ||
          !input.routeSwitchOperationId || decisions.length !== 2) {
          throw new Error("PRODUCTION_PROMOTION_FINAL_VALIDATION_INPUT_MISSING");
        }
        await assertProductionPromotionCurrent(tx, {
          commandId: input.promotionCommand.id,
          lease: input.promotionLease,
          candidate: input.productionCandidate,
          actorId: input.actorId,
          routeSwitchOperationId: input.routeSwitchOperationId,
          preDecision: decisions[0],
          postDecision: decisions[1],
        });
      }
      const completion = await completeVersionedDeployment(
        tx,
        input,
        input.routeSwitchAttempt && input.routeSwitchOperationId
          ? (client) =>
              this.routeSaga.commit(
                client,
                input.routeSwitchOperationId!,
                input.routeSwitchAttempt!,
              )
          : undefined,
      );
      const run = await tx.deploymentRun.findUniqueOrThrow({
        where: { id: input.deploymentRunId },
      });
      if (input.promotionCommand) {
        await completeProductionPromotionCommand(tx, {
          commandId: input.promotionCommand.id,
          deploymentRunId: run.id,
          candidateHash: input.promotionCommand.candidateHash,
          status: input.status,
          result: input.promotionCommand.result,
          errorCode: input.promotionCommand.errorCode,
          errorMessage: input.promotionCommand.errorMessage,
          lease: input.promotionLease,
        });
      }
      for (const decision of decisions) {
        await claimReleaseGateDecision(tx, {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          actorId: input.actorId,
          decisionId: decision.id,
          stage: decision.stage,
          inputHash: decision.inputHash,
          actionRunType: "deployment_run",
          actionRunId: run.id,
          requireAllowed: input.status === "completed",
        });
      }
      return { run, version: completion.version };
    });
  }
}
