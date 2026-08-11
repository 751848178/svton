import { Injectable } from "@nestjs/common";
import type {
  SiteProbePort,
  SiteRouteActivationPort,
} from "../site/site-route-activation.types";
import { createSiteRouteSwitchInput } from "../site/site-route-switch-receipt.policy";
import type {
  SiteRouteSwitchAttemptPersistence,
  SiteRouteSwitchInput,
} from "../site/site-route-switch.types";
import type { SiteRouteSwitchSagaOrchestrator } from "../site/site-route-switch-saga.orchestrator";
import { assertSiteProbeAcceptable } from "../site/site-probe-policy";
import type { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { environmentDeploymentFailureDetail } from "./environment-version-failure.utils";
import type { EnvironmentVersionGateContext } from "./environment-version-gate-admission";
import {
  gateDecisionReference,
  type EnvironmentVersionProductionGateService,
} from "./environment-version-production-gate.service";
import { ReleaseGateBlockedException } from "./release-gate-decision.service";
import type { ProductionPromotionCommandRepository } from "./production-promotion-command.repository";
import type { ProductionPromotionResumeInput } from "./production-promotion-command.types";
import type { ProductionPromotionObservationRepository } from "./production-promotion-observation.repository";
import {
  routeBooleanValue,
  routeSnapshotRecord,
} from "./environment-version-route-switch-evidence";

@Injectable()
export class ProductionPromotionService {
  constructor(
    private readonly commands: ProductionPromotionCommandRepository,
    private readonly gates: EnvironmentVersionProductionGateService,
    private readonly routeActivation: SiteRouteActivationPort,
    private readonly routeSaga: SiteRouteSwitchSagaOrchestrator,
    private readonly siteProbe: SiteProbePort,
    private readonly observations: ProductionPromotionObservationRepository,
    private readonly completion: EnvironmentVersionCompletionRepository,
  ) {}

  async resume(input: ProductionPromotionResumeInput) {
    const reservation = await this.commands.reserve(input);
    if (reservation.idempotentReplay) return reservation.command;
    let request: SiteRouteSwitchInput | undefined;
    let attempt: SiteRouteSwitchAttemptPersistence | undefined;
    try {
      const context = gateContext(reservation.candidate, input.actorId);
      const preDecision = await this.gates.promote({
        ...context,
        promotionCommandId: reservation.command.id,
      });
      const activation = await this.routeActivation.resolve({
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        routeSnapshot: routeSnapshotRecord(reservation.routeSnapshot) ?? null,
      });
      request = createSiteRouteSwitchInput({
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        deploymentRunId: input.deploymentRunId,
        releaseRunId: input.releaseRunId,
        targetRef: reservation.candidate.targetRef,
        activation,
      });
      attempt = await this.routeSaga.apply(request);
      const probe = await this.siteProbe.probe({
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        deploymentRunId: input.deploymentRunId,
        primaryDomain: activation.primaryDomain,
        tlsRequired: routeBooleanValue(
          routeSnapshotRecord(reservation.routeSnapshot)?.tlsRequired,
        ),
        targetRef: reservation.candidate.targetRef,
      });
      assertSiteProbeAcceptable(
        probe,
        attempt.evidence as unknown as Record<string, unknown>,
      );
      attempt = { ...attempt, siteProbe: probe, dnsProbe: probe.dns, tlsProbe: probe.tls };
      await this.observations.record({
        operationId: request.operationId,
        releaseRunId: input.releaseRunId,
        deploymentRunId: input.deploymentRunId,
        candidateHash: input.candidateHash,
        probe,
      });
      const postDecision = await this.gates.postRoute({
        ...context,
        promotionCommandId: reservation.command.id,
        routeSwitchOperationId: request.operationId,
      });
      return this.completion.complete({
        deploymentRunId: input.deploymentRunId,
        expectedStatus: "awaiting_validation",
        kind: reservation.candidate.kind,
        teamId: input.teamId,
        actorId: input.actorId,
        projectId: input.projectId,
        releaseOrderId: reservation.candidate.releaseOrderId,
        status: "completed",
        logs: stringList(reservation.deploymentLogs),
        result: {
          ...record(reservation.deploymentResult),
          productionCandidate: reservation.candidate,
          siteProbe: probe,
          routeSwitch: attempt.evidence,
          promotionStatus: "completed",
        },
        gateDecisions: [preDecision, postDecision]
          .map(gateDecisionReference)
          .filter((value): value is NonNullable<typeof value> => Boolean(value)),
        routeSwitchAttempt: attempt,
        routeSwitchOperationId: request.operationId,
        promotionCommand: {
          id: reservation.command.id,
          candidateHash: input.candidateHash,
          result: { routeSwitchOperationId: request.operationId },
        },
      });
    } catch (error) {
      return this.fail(reservation, input, request, error);
    }
  }

  private async fail(
    reservation: Awaited<ReturnType<ProductionPromotionCommandRepository["reserve"]>>,
    input: ProductionPromotionResumeInput,
    request: SiteRouteSwitchInput | undefined,
    error: unknown,
  ) {
    const detail = environmentDeploymentFailureDetail(error);
    if (!request) {
      await this.commands.finish({
        commandId: reservation.command.id,
        status: error instanceof ReleaseGateBlockedException ? "blocked" : "failed",
        errorCode: detail.code,
        errorMessage: detail.message,
      });
      return {
        ...reservation.command,
        status: error instanceof ReleaseGateBlockedException ? "blocked" : "failed",
        awaitingValidation: true,
        gateDecision: gateDecisionReference(
          error instanceof ReleaseGateBlockedException ? error.decision : undefined,
        ),
      };
    }
    const compensation = await this.routeSaga.compensate(request.operationId, error);
    const status = compensation === "compensation_required" ? "blocked" : "failed";
    return this.completion.complete({
      deploymentRunId: input.deploymentRunId,
      expectedStatus: "awaiting_validation",
      kind: reservation.candidate.kind,
      teamId: input.teamId,
      actorId: input.actorId,
      projectId: input.projectId,
      releaseOrderId: reservation.candidate.releaseOrderId,
      status,
      logs: detail.logs,
      error: `${detail.code}: ${detail.message}`,
      promotionCommand: {
        id: reservation.command.id,
        candidateHash: input.candidateHash,
        errorCode: detail.code,
        errorMessage: detail.message,
      },
    });
  }
}

function gateContext(
  candidate: Awaited<ReturnType<ProductionPromotionCommandRepository["reserve"]>>["candidate"],
  actorId: string,
): EnvironmentVersionGateContext & { deploymentRunId: string; candidateHash: string } {
  return {
    ...candidate,
    actorId,
    bindingId: candidate.bindingId ?? undefined,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
