import type {
  SiteProbePort,
  SiteRouteActivationPort,
} from "../site/site-route-activation.types";
import { SiteRouteSwitchPort } from "../site/site-route-switch.port";
import {
  createSiteRouteSwitchInput,
  siteRouteSwitchEvidence,
} from "../site/site-route-switch-receipt.policy";
import type {
  SiteRouteSwitchAttemptPersistence,
  SiteRouteSwitchReceipt,
} from "../site/site-route-switch.types";
import {
  assertSiteProbeAcceptable,
  extractSiteEvidence,
} from "../site/site-probe-policy";
import type { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { environmentDeploymentFailureDetail } from "./environment-version-failure.utils";
import type { EnvironmentVersionExecutionContext } from "./environment-version-execution.types";
import {
  type EnvironmentVersionProductionGateService,
  gateDecisionReference,
} from "./environment-version-production-gate.service";
import {
  routeBooleanValue,
  routeSnapshotRecord,
  routeSwitchFailure,
  unavailableSiteRouteSwitchEvidence,
} from "./environment-version-route-switch-evidence";

export interface EnvironmentVersionFinalizationDependencies {
  completion: EnvironmentVersionCompletionRepository;
  productionGates: EnvironmentVersionProductionGateService;
  routeActivation: SiteRouteActivationPort;
  routeSwitch: SiteRouteSwitchPort;
  siteProbe: SiteProbePort;
}

export async function finalizeDeployedEnvironment(
  deps: EnvironmentVersionFinalizationDependencies,
  context: EnvironmentVersionExecutionContext,
  logs: string[],
  deploymentEvidence: Record<string, unknown>,
) {
  let attempt: SiteRouteSwitchAttemptPersistence | undefined;
  try {
    const targetRef =
      context.frozenInput?.deploymentInput.snapshot.target.targetRef ??
      "unconfigured";
    const routeSnapshot = routeSnapshotRecord(
      context.productionRun?.routeSnapshot,
    );
    const activation = await deps.routeActivation.resolve({
      teamId: context.input.teamId,
      projectId: context.input.projectId,
      environmentId: context.environment.id,
      routeSnapshot: routeSnapshot ?? null,
    });
    let routeSwitch: Record<string, unknown> =
      unavailableSiteRouteSwitchEvidence(context, activation, targetRef);
    if (context.releaseRunId && activation.siteId && activation.primaryDomain) {
      const request = createSiteRouteSwitchInput({
        teamId: context.input.teamId,
        projectId: context.input.projectId,
        environmentId: context.environment.id,
        deploymentRunId: context.run.id,
        releaseRunId: context.releaseRunId,
        targetRef,
        activation,
      });
      const receipt = await invokeRouteSwitch(deps.routeSwitch, request);
      const evidence = siteRouteSwitchEvidence(
        request,
        receipt,
        deps.routeSwitch.identity,
      );
      routeSwitch = evidence as unknown as Record<string, unknown>;
      attempt = { evidence };
      if (evidence.status !== "switched") {
        throw routeSwitchFailure(evidence);
      }
    }
    const probe = await deps.siteProbe.probe({
      teamId: context.input.teamId,
      projectId: context.input.projectId,
      environmentId: context.environment.id,
      deploymentRunId: context.run.id,
      primaryDomain: activation.primaryDomain,
      tlsRequired: routeBooleanValue(routeSnapshot?.tlsRequired),
      targetRef,
    });
    assertSiteProbeAcceptable(probe, routeSwitch);
    if (attempt) {
      attempt = {
        ...attempt,
        siteProbe: probe,
        dnsProbe: probe.dns,
        tlsProbe: probe.tls,
      };
    }
    const decision = await deps.productionGates.finalize({
      ...context.gateContext,
      deploymentRunId: context.run.id,
    });
    return deps.completion.complete({
      ...completionIdentity(context),
      status: "completed",
      logs,
      result: {
        ...deploymentEvidence,
        siteProbe: probe,
        routeSwitch,
        gateDecision: gateDecisionReference(decision),
      },
      gateDecision: gateDecisionReference(decision),
      routeSwitchAttempt: attempt,
    });
  } catch (error) {
    return completeFailedEnvironment(deps, context, error, attempt);
  }
}

export async function completeFailedEnvironment(
  deps: EnvironmentVersionFinalizationDependencies,
  context: EnvironmentVersionExecutionContext,
  error: unknown,
  attempt?: SiteRouteSwitchAttemptPersistence,
) {
  const detail = environmentDeploymentFailureDetail(error);
  const denied = await deps.productionGates.denied(error, {
    ...context.gateContext,
    deploymentRunId: context.run.id,
  });
  return deps.completion.complete({
    ...completionIdentity(context),
    status: "failed",
    logs: detail.logs,
    error: `${detail.code}: ${detail.message}`,
    result: {
      manifestId: context.manifest.id,
      manifestDigest: context.manifest.digest,
      ...extractSiteEvidence(error),
      gateDecision: gateDecisionReference(denied),
    },
    gateDecision: gateDecisionReference(denied),
    routeSwitchAttempt: attempt,
  });
}

async function invokeRouteSwitch(
  provider: SiteRouteSwitchPort,
  input: Parameters<SiteRouteSwitchPort["switchRoute"]>[0],
): Promise<SiteRouteSwitchReceipt> {
  try {
    return await provider.switchRoute(input);
  } catch {
    return {
      version: provider.identity.receiptVersion,
      providerKey: provider.identity.providerKey,
      operationId: input.operationId,
      status: "failed",
      reasonCode: "route_switch_provider_failed",
      observedAt: null,
      observed: null,
    };
  }
}

function completionIdentity(context: EnvironmentVersionExecutionContext) {
  return {
    deploymentRunId: context.run.id,
    kind: context.input.kind,
    teamId: context.input.teamId,
    actorId: context.input.actorId,
    projectId: context.input.projectId,
    releaseOrderId: context.manifest.releaseOrderId,
  };
}
