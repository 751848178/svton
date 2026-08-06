import { Injectable } from "@nestjs/common";
import {
  ReleaseGateBlockedException,
  ReleaseGateDecisionService,
} from "./release-gate-decision.service";
import type {
  ReleaseGateDecision,
  ReleaseGateDecisionReference,
} from "./release-gate-decision.types";

type ProductionGateContext = {
  teamId: string;
  actorId: string;
  projectId: string;
  releaseOrderId: string;
  environmentId: string;
  configRevisionId: string | null;
  manifestId: string;
  buildRunId: string;
  releaseRunId?: string;
  deploymentRunId?: string;
};

@Injectable()
export class EnvironmentVersionProductionGateService {
  constructor(private readonly gates: ReleaseGateDecisionService) {}

  admit(context: ProductionGateContext) {
    if (!context.releaseRunId) return undefined;
    return this.gates.assertAllowed({
      ...scope(context),
      stage: "production",
      target: target(context),
      actionInput: {
        checkpoint: "pre_execution",
        environmentId: context.environmentId,
        configRevisionId: context.configRevisionId,
        manifestId: context.manifestId,
        buildRunId: context.buildRunId,
        releaseRunId: context.releaseRunId,
      },
      requestKey: `pre:${context.releaseRunId}`,
      deferredReasons: {
        D06: ["traffic_strategy_provider_missing"],
        D09: ["network_policy_provider_missing"],
        D17: ["production_deployment_missing"],
        D20: ["recovery_compatibility_provider_missing"],
        D14: [
          "dns_probe_missing",
          "dns_probe_unavailable",
          "dns_provider_missing",
        ],
        D15: [
          "tls_probe_missing",
          "tls_probe_unavailable",
          "tls_provider_missing",
        ],
      },
    });
  }

  finalize(context: ProductionGateContext & { deploymentRunId: string }) {
    if (!context.releaseRunId) return undefined;
    return this.gates.assertAllowed({
      ...scope(context),
      stage: "production",
      target: target(context),
      actionInput: {
        checkpoint: "post_execution",
        deploymentRunId: context.deploymentRunId,
        environmentId: context.environmentId,
        configRevisionId: context.configRevisionId,
        buildRunId: context.buildRunId,
        manifestId: context.manifestId,
        releaseRunId: context.releaseRunId,
      },
      requestKey: `final:${context.releaseRunId}:${context.deploymentRunId}`,
      deferredReasons: {
        D06: ["traffic_strategy_provider_missing"],
        D09: ["network_policy_provider_missing"],
        D20: ["recovery_compatibility_provider_missing"],
        D14: [
          "dns_probe_missing",
          "dns_probe_unavailable",
          "dns_provider_missing",
        ],
        D15: [
          "tls_probe_missing",
          "tls_probe_unavailable",
          "tls_provider_missing",
        ],
      },
    });
  }

  async denied(
    error: unknown,
    context: ProductionGateContext & { deploymentRunId: string },
  ) {
    if (!context.releaseRunId) return undefined;
    if (error instanceof ReleaseGateBlockedException) return error.decision;
    try {
      return await this.gates.assertAllowed({
        ...scope(context),
        stage: "production",
        target: target(context),
        actionInput: {
          checkpoint: "execution_failed",
          deploymentRunId: context.deploymentRunId,
          environmentId: context.environmentId,
          configRevisionId: context.configRevisionId,
          buildRunId: context.buildRunId,
          manifestId: context.manifestId,
          releaseRunId: context.releaseRunId,
        },
        requestKey: `final:${context.releaseRunId}:${context.deploymentRunId}`,
        deferredReasons: {
          D06: ["traffic_strategy_provider_missing"],
          D09: ["network_policy_provider_missing"],
          D20: ["recovery_compatibility_provider_missing"],
          D14: [
            "dns_probe_missing",
            "dns_probe_unavailable",
            "dns_provider_missing",
          ],
          D15: [
            "tls_probe_missing",
            "tls_probe_unavailable",
            "tls_provider_missing",
          ],
        },
      });
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

function scope(context: ProductionGateContext) {
  return {
    teamId: context.teamId,
    actorId: context.actorId,
    projectId: context.projectId,
    releaseOrderId: context.releaseOrderId,
  };
}

function target(context: ProductionGateContext) {
  return {
    buildRunId: context.buildRunId,
    manifestId: context.manifestId,
    releaseRunId: context.releaseRunId,
    deploymentRunId: context.deploymentRunId,
    environmentId: context.environmentId,
    configRevisionId: context.configRevisionId,
  };
}
