import type {
  SiteProbePort,
  SiteRouteActivationPort,
} from "../site/site-route-activation.types";
import type { SiteRouteSwitchSagaOrchestrator } from "../site/site-route-switch-saga.orchestrator";
import { createSiteRouteSwitchInput } from "../site/site-route-switch-receipt.policy";
import type {
  SiteRouteSwitchAttemptPersistence,
  SiteRouteSwitchInput,
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
  unavailableSiteRouteSwitchEvidence,
} from "./environment-version-route-switch-evidence";

export interface EnvironmentVersionFinalizationDependencies {
  completion: EnvironmentVersionCompletionRepository;
  productionGates: EnvironmentVersionProductionGateService;
  routeActivation: SiteRouteActivationPort;
  routeSaga: SiteRouteSwitchSagaOrchestrator;
  siteProbe: SiteProbePort;
}

export async function finalizeDeployedEnvironment(
  deps: EnvironmentVersionFinalizationDependencies,
  context: EnvironmentVersionExecutionContext,
  logs: string[],
  deploymentEvidence: Record<string, unknown>,
) {
  let attempt: SiteRouteSwitchAttemptPersistence | undefined;
  let request: SiteRouteSwitchInput | undefined;
  try {
    await deps.routeSaga.assertProductionReady();
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
      request = createSiteRouteSwitchInput({
        teamId: context.input.teamId,
        projectId: context.input.projectId,
        environmentId: context.environment.id,
        deploymentRunId: context.run.id,
        releaseRunId: context.releaseRunId,
        targetRef,
        activation,
      });
      attempt = await deps.routeSaga.apply(request);
      const evidence = attempt.evidence;
      routeSwitch = evidence as unknown as Record<string, unknown>;
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
    const postDecision = await deps.productionGates.finalize({
      ...context.gateContext,
      deploymentRunId: context.run.id,
    });
    const promoteDecision = await deps.productionGates.promote({
      ...context.gateContext,
      deploymentRunId: context.run.id,
    });
    return await deps.completion.complete({
      ...completionIdentity(context),
      status: "completed",
      logs,
      result: {
        ...deploymentEvidence,
        siteProbe: probe,
        routeSwitch,
        gateDecision: gateDecisionReference(promoteDecision),
      },
      gateDecisions: [postDecision, promoteDecision]
        .map(gateDecisionReference)
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      routeSwitchAttempt: attempt,
      routeSwitchOperationId: request?.operationId,
    });
  } catch (error) {
    const compensation = request
      ? await deps.routeSaga.compensate(request.operationId, error)
      : "not_applied";
    return completeFailedEnvironment(
      deps,
      context,
      error,
      compensation === "compensation_required" ? "blocked" : "failed",
    );
  }
}

export async function completeFailedEnvironment(
  deps: EnvironmentVersionFinalizationDependencies,
  context: EnvironmentVersionExecutionContext,
  error: unknown,
  status: "failed" | "blocked" = "failed",
) {
  const detail = environmentDeploymentFailureDetail(error);
  const denied = await deps.productionGates.denied(error, {
    ...context.gateContext,
    deploymentRunId: context.run.id,
  });
  return deps.completion.complete({
    ...completionIdentity(context),
    status,
    logs: detail.logs,
    error: `${detail.code}: ${detail.message}`,
    result: {
      manifestId: context.manifest.id,
      manifestDigest: context.manifest.digest,
      ...extractSiteEvidence(error),
      gateDecision: gateDecisionReference(denied),
    },
    gateDecision: gateDecisionReference(denied),
  });
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
