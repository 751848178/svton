import { Injectable } from "@nestjs/common";
import {
  ReleaseGateBlockedException,
  ReleaseGateDecisionService,
} from "./release-gate-decision.service";
import type {
  ReleaseGateDecision,
  ReleaseGateDecisionReference,
} from "./release-gate-decision.types";
import {
  admitEnvironmentVersion,
  type EnvironmentVersionGateContext,
  finalEnvironmentVersionDecision,
  promoteEnvironmentVersionDecision,
} from "./environment-version-gate-admission";
import { ProductionRouteSagaGuard } from "../site/production-route-saga.guard";

@Injectable()
export class EnvironmentVersionProductionGateService {
  constructor(
    private readonly gates: ReleaseGateDecisionService,
    private readonly routeSagaGuard: ProductionRouteSagaGuard,
  ) {}

  async admit(
    context: EnvironmentVersionGateContext,
    stage: "staging" | "production" = "production",
  ) {
    if (stage === "production") {
      await this.routeSagaGuard.assertClear(context);
      if (!context.releaseRunId) return undefined;
    }
    return admitEnvironmentVersion(this.gates, context, stage);
  }

  finalize(
    context: EnvironmentVersionGateContext & { deploymentRunId: string },
  ) {
    if (!context.releaseRunId) return undefined;
    return finalEnvironmentVersionDecision(
      this.gates,
      context,
    );
  }

  promote(
    context: EnvironmentVersionGateContext & { deploymentRunId: string },
  ) {
    if (!context.releaseRunId) return undefined;
    return promoteEnvironmentVersionDecision(this.gates, context);
  }

  async denied(
    error: unknown,
    context: EnvironmentVersionGateContext & { deploymentRunId: string },
  ) {
    if (!context.releaseRunId) return undefined;
    if (error instanceof ReleaseGateBlockedException) return error.decision;
    try {
      return await finalEnvironmentVersionDecision(
        this.gates,
        context,
      );
    } catch (gateError) {
      return gateError instanceof ReleaseGateBlockedException
        ? gateError.decision
        : undefined;
    }
  }
}

export function gateDecisionReference(
  decision?: ReleaseGateDecision,
): ReleaseGateDecisionReference | undefined {
  return decision
    ? { id: decision.id, stage: decision.stage, inputHash: decision.inputHash }
    : undefined;
}
