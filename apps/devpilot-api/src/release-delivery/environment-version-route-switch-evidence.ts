import type { SiteRouteActivationResolveResult } from "../site/site-route-activation.types";
import { SiteRouteActivationError } from "../site/site-probe-policy";
import type { SiteRouteSwitchEvidence } from "../site/site-route-switch.types";
import type { EnvironmentVersionExecutionContext } from "./environment-version-execution.types";

export function unavailableSiteRouteSwitchEvidence(
  context: EnvironmentVersionExecutionContext,
  activation: SiteRouteActivationResolveResult,
  targetRef: string,
) {
  return {
    version: 1,
    siteId: activation.siteId,
    primaryDomain: activation.primaryDomain,
    deploymentRunId: context.run.id,
    releaseRunId: context.releaseRunId ?? null,
    targetRef,
    proxyTarget: activation.proxyTarget,
    domains: activation.domains,
    status: "unavailable",
    reasonCode: activation.reasonCode,
    switchedAt: null,
  };
}

export function routeSwitchFailure(evidence: SiteRouteSwitchEvidence) {
  return new SiteRouteActivationError({
    code: "SITE_ROUTE_ACTIVATION_FAILED",
    message: "Production 路由 provider 未返回匹配的 read-after-write receipt",
    evidence: { routeSwitch: evidence },
  });
}

export function routeSnapshotRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function routeBooleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
