import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SiteRouteSwitchSagaRepository } from "../site/site-route-switch-saga.repository";
import type { SiteRouteSwitchAttemptPersistence } from "../site/site-route-switch.types";
import { completeVersionedDeployment } from "./environment-version-write.utils";
import { claimReleaseGateDecision } from "./release-gate-decision.repository";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";

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
      routeSwitchAttempt?: SiteRouteSwitchAttemptPersistence;
      routeSwitchOperationId?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
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
      if (input.gateDecision) {
        await claimReleaseGateDecision(tx, {
          teamId: input.teamId,
          projectId: input.projectId,
          releaseOrderId: input.releaseOrderId,
          actorId: input.actorId,
          decisionId: input.gateDecision.id,
          stage: input.gateDecision.stage,
          inputHash: input.gateDecision.inputHash,
          actionRunType: "deployment_run",
          actionRunId: run.id,
          requireAllowed: input.status === "completed",
        });
      }
      return { run, version: completion.version };
    });
  }
}
