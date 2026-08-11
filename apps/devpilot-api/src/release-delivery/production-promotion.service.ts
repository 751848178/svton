import { Injectable } from "@nestjs/common";
import type { SiteProbePort, SiteRouteActivationPort } from "../site/site-route-activation.types";
import { createSiteRouteSwitchInput } from "../site/site-route-switch-receipt.policy";
import type { SiteRouteSwitchAttemptPersistence, SiteRouteSwitchInput } from "../site/site-route-switch.types";
import type { SiteRouteSwitchSagaOrchestrator } from "../site/site-route-switch-saga.orchestrator";
import type { SiteRouteSwitchSagaReadbackService } from "../site/site-route-switch-saga-readback.service";
import { assertSiteProbeAcceptable } from "../site/site-probe-policy";
import type { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { environmentDeploymentFailureDetail } from "./environment-version-failure.utils";
import type { EnvironmentVersionGateContext } from "./environment-version-gate-admission";
import { gateDecisionReference, type EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { routeBooleanValue, routeSnapshotRecord } from "./environment-version-route-switch-evidence";
import type { ProductionPromotionCommandRepository } from "./production-promotion-command.repository";
import type { ProductionPromotionResumeInput, ReservedProductionPromotionCommand } from "./production-promotion-command.types";
import { withProductionPromotionHeartbeat } from "./production-promotion-heartbeat";
import { ProductionPromotionLeaseLostError, ProductionPromotionRecoveryPendingError, type ProductionPromotionLease } from "./production-promotion-lease.policy";
import type { ProductionPromotionObservationRepository } from "./production-promotion-observation.repository";
import { ReleaseGateBlockedException } from "./release-gate-decision.service";
import type { ReleaseGateDecisionReference } from "./release-gate-decision.types";

@Injectable()
export class ProductionPromotionService {
  constructor(
    private readonly commands: ProductionPromotionCommandRepository,
    private readonly gates: EnvironmentVersionProductionGateService,
    private readonly routeActivation: SiteRouteActivationPort,
    private readonly routeSaga: SiteRouteSwitchSagaOrchestrator,
    private readonly routeReadback: SiteRouteSwitchSagaReadbackService,
    private readonly siteProbe: SiteProbePort,
    private readonly observations: ProductionPromotionObservationRepository,
    private readonly completion: EnvironmentVersionCompletionRepository,
  ) {}

  async resume(input: ProductionPromotionResumeInput) {
    const reservation = await this.commands.reserve(input);
    if (!reservation.shouldExecute || !reservation.lease) return reservation.command;
    const lease = reservation.lease;
    let request: SiteRouteSwitchInput | undefined;
    let attempt: SiteRouteSwitchAttemptPersistence | undefined;
    try {
      const context = gateContext(reservation.candidate, input.actorId);
      let phase = reservation.command.phase;
      let pre: ReleaseGateDecisionReference | null = decision(reservation.command, "pre");
      let post: ReleaseGateDecisionReference | null = decision(reservation.command, "post");
      if (phase === "reserved") {
        const value = await this.withLease(reservation, lease, async () => {
          const gate = await this.gates.promote({ ...context,
            promotionCommandId: reservation.command.id });
          if (!gate) throw new Error("PRODUCTION_PRE_GATE_DECISION_MISSING");
          return gate;
        });
        pre = requiredReference(value);
        await this.commands.advance({ commandId: reservation.command.id, lease,
          from: phase, to: "pre_gate_allowed", data: decisionData("pre", pre) });
        phase = "pre_gate_allowed";
      }
      const activation = await this.withLease(reservation, lease, () =>
        this.routeActivation.resolve({ teamId: input.teamId, projectId: input.projectId,
          environmentId: input.environmentId,
          routeSnapshot: routeSnapshotRecord(reservation.routeSnapshot) ?? null }));
      request = createSiteRouteSwitchInput({
        teamId: input.teamId, projectId: input.projectId,
        environmentId: input.environmentId, deploymentRunId: input.deploymentRunId,
        releaseRunId: input.releaseRunId, targetRef: reservation.candidate.targetRef,
        activation,
      });
      if (reservation.recovered && reservation.command.routeSwitchOperationId) {
        const state = await this.withLease(reservation, lease, () =>
          this.routeReadback.inspect(reservation.command.routeSwitchOperationId!));
        if (["unknown", "recovering", "committed"].includes(state)) {
          throw new ProductionPromotionRecoveryPendingError();
        }
      }
      attempt = await this.withLease(reservation, lease, () => this.routeSaga.apply(request!));
      if (phase === "pre_gate_allowed") {
        await this.commands.advance({ commandId: reservation.command.id, lease,
          from: phase, to: "route_switched",
          data: { routeSwitchOperationId: request.operationId } });
        phase = "route_switched";
      }
      if (phase === "route_switched") {
        const probe = await this.withLease(reservation, lease, () => this.siteProbe.probe({
          teamId: input.teamId, projectId: input.projectId,
          environmentId: input.environmentId, deploymentRunId: input.deploymentRunId,
          primaryDomain: activation.primaryDomain,
          tlsRequired: routeBooleanValue(routeSnapshotRecord(reservation.routeSnapshot)?.tlsRequired),
          targetRef: reservation.candidate.targetRef,
        }));
        assertSiteProbeAcceptable(probe, attempt.evidence as unknown as Record<string, unknown>);
        await this.withLease(reservation, lease, () => this.observations.record({
          operationId: request!.operationId, releaseRunId: input.releaseRunId,
          deploymentRunId: input.deploymentRunId,
          candidateHash: input.candidateHash, probe,
        }));
        attempt = { ...attempt, siteProbe: probe, dnsProbe: probe.dns, tlsProbe: probe.tls };
        await this.commands.advance({ commandId: reservation.command.id, lease,
          from: phase, to: "observed", data: { observationRecordedAt: new Date() } });
        phase = "observed";
      } else {
        const observation = await this.observations.loadExact({
          operationId: request.operationId, releaseRunId: input.releaseRunId,
          deploymentRunId: input.deploymentRunId, candidateHash: input.candidateHash,
        });
        attempt = { ...attempt, siteProbe: observation.probe,
          dnsProbe: observation.probe.dns, tlsProbe: observation.probe.tls };
      }
      if (phase === "observed") {
        const value = await this.withLease(reservation, lease, async () => {
          const gate = await this.gates.postRoute({ ...context,
            promotionCommandId: reservation.command.id,
            routeSwitchOperationId: request!.operationId });
          if (!gate) throw new Error("PRODUCTION_POST_GATE_DECISION_MISSING");
          return gate;
        });
        post = requiredReference(value);
        await this.commands.advance({ commandId: reservation.command.id, lease,
          from: phase, to: "post_gate_allowed", data: decisionData("post", post) });
      }
      return this.complete(reservation, input, lease, request, attempt, pre!, post!);
    } catch (error) {
      if (error instanceof ProductionPromotionLeaseLostError ||
        error instanceof ProductionPromotionRecoveryPendingError) throw error;
      return this.fail(reservation, input, lease, request, error);
    }
  }

  private withLease<T>(r: ReservedProductionPromotionCommand, lease: ProductionPromotionLease, action: () => Promise<T>) {
    return withProductionPromotionHeartbeat({ commands: this.commands,
      commandId: r.command.id, lease, action });
  }

  private complete(r: ReservedProductionPromotionCommand, input: ProductionPromotionResumeInput,
    lease: ProductionPromotionLease, request: SiteRouteSwitchInput,
    attempt: SiteRouteSwitchAttemptPersistence, pre: ReleaseGateDecisionReference,
    post: ReleaseGateDecisionReference) {
    const probe = attempt.siteProbe!;
    return this.completion.complete({ deploymentRunId: input.deploymentRunId,
      expectedStatus: "awaiting_validation", kind: r.candidate.kind,
      teamId: input.teamId, actorId: input.actorId, projectId: input.projectId,
      releaseOrderId: r.candidate.releaseOrderId, status: "completed",
      logs: stringList(r.deploymentLogs), promotionLease: lease,
      productionCandidate: r.candidate,
      result: { ...record(r.deploymentResult), productionCandidate: r.candidate,
        siteProbe: probe, routeSwitch: attempt.evidence, promotionStatus: "completed" },
      gateDecisions: [pre, post], routeSwitchAttempt: attempt,
      routeSwitchOperationId: request.operationId,
      promotionCommand: { id: r.command.id, candidateHash: input.candidateHash,
        result: { routeSwitchOperationId: request.operationId } } });
  }

  private async fail(r: ReservedProductionPromotionCommand, input: ProductionPromotionResumeInput,
    lease: ProductionPromotionLease, request: SiteRouteSwitchInput | undefined, error: unknown) {
    const detail = environmentDeploymentFailureDetail(error);
    if (!request) {
      await this.commands.finish({ commandId: r.command.id, lease,
        status: error instanceof ReleaseGateBlockedException ? "blocked" : "failed",
        errorCode: detail.code, errorMessage: detail.message });
      return { ...r.command, status: error instanceof ReleaseGateBlockedException ? "blocked" : "failed",
        awaitingValidation: true,
        gateDecision: gateDecisionReference(error instanceof ReleaseGateBlockedException ? error.decision : undefined) };
    }
    const compensation = await this.withLease(r, lease, () => this.routeSaga.compensate(request.operationId, error));
    const status = compensation === "compensation_required" ? "blocked" : "failed";
    return this.completion.complete({ deploymentRunId: input.deploymentRunId,
      expectedStatus: "awaiting_validation", kind: r.candidate.kind,
      teamId: input.teamId, actorId: input.actorId, projectId: input.projectId,
      releaseOrderId: r.candidate.releaseOrderId, status, logs: detail.logs,
      error: `${detail.code}: ${detail.message}`, promotionLease: lease,
      promotionCommand: { id: r.command.id, candidateHash: input.candidateHash,
        errorCode: detail.code, errorMessage: detail.message } });
  }
}

function gateContext(candidate: ReservedProductionPromotionCommand["candidate"], actorId: string): EnvironmentVersionGateContext & { deploymentRunId: string; candidateHash: string } {
  return { ...candidate, actorId, bindingId: candidate.bindingId ?? undefined };
}
function requiredReference(value: unknown) {
  const ref = gateDecisionReference(value as never);
  if (!ref) throw new Error("PRODUCTION_GATE_DECISION_REFERENCE_MISSING");
  return ref;
}
function decision(command: ReservedProductionPromotionCommand["command"], side: "pre" | "post"): ReleaseGateDecisionReference | null {
  const id = command[`${side}DecisionId`]; const inputHash = command[`${side}DecisionInputHash`];
  const actionInputHash = command[`${side}DecisionActionHash`];
  return id && inputHash && actionInputHash ? { id, inputHash, actionInputHash, stage: "production" as const } : null;
}
function decisionData(side: "pre" | "post", ref: ReleaseGateDecisionReference) {
  const prefix = side === "pre" ? "preDecision" : "postDecision";
  return { [`${prefix}Id`]: ref.id, [`${prefix}InputHash`]: ref.inputHash,
    [`${prefix}ActionHash`]: ref.actionInputHash };
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
