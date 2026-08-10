import { createHash } from "node:crypto";
import type { SiteRouteActivationResolveResult } from "./site-route-activation.types";
import type {
  SiteRouteSwitchEvidence,
  SiteRouteSwitchInput,
  SiteRouteSwitchProviderIdentity,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

export function createSiteRouteSwitchInput(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  deploymentRunId: string;
  releaseRunId: string | null;
  targetRef: string;
  activation: SiteRouteActivationResolveResult;
}): SiteRouteSwitchInput {
  if (!input.activation.siteId || !input.activation.primaryDomain) {
    throw new Error("SITE_ROUTE_SWITCH_IDENTITY_MISSING");
  }
  const routeHash = hashRoute({
    siteId: input.activation.siteId,
    primaryDomain: input.activation.primaryDomain,
    domains: input.activation.domains,
    entries: input.activation.entries,
    proxyTarget: input.activation.proxyTarget,
    targetRef: input.targetRef,
  });
  return {
    version: 1,
    operationId: `site-route:${input.deploymentRunId}:${routeHash}`,
    teamId: input.teamId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    siteId: input.activation.siteId,
    deploymentRunId: input.deploymentRunId,
    releaseRunId: input.releaseRunId,
    primaryDomain: input.activation.primaryDomain,
    domains: [...input.activation.domains],
    entries: input.activation.entries.map((entry) => ({ ...entry })),
    proxyTarget: input.activation.proxyTarget,
    targetRef: input.targetRef,
    routeHash,
  };
}

export function siteRouteSwitchEvidence(
  input: SiteRouteSwitchInput,
  receipt: SiteRouteSwitchReceipt,
  expectedProvider: SiteRouteSwitchProviderIdentity,
): SiteRouteSwitchEvidence {
  const validation = validateSiteRouteSwitchReceipt(
    input,
    receipt,
    expectedProvider,
  );
  return {
    ...input,
    providerKey: receipt.providerKey,
    status: validation.accepted ? "switched" : receipt.status === "unavailable" ? "unavailable" : "failed",
    reasonCode: validation.reasonCode,
    switchedAt: validation.accepted ? receipt.observedAt : null,
    receipt,
  };
}

export function validateSiteRouteSwitchReceipt(
  input: SiteRouteSwitchInput,
  receipt: SiteRouteSwitchReceipt,
  expectedProvider: SiteRouteSwitchProviderIdentity,
): { accepted: boolean; reasonCode: string } {
  if (receipt.status !== "switched") {
    return { accepted: false, reasonCode: receipt.reasonCode };
  }
  if (receipt.version !== expectedProvider.receiptVersion) {
    return {
      accepted: false,
      reasonCode: "route_switch_receipt_version_mismatch",
    };
  }
  if (!receipt.providerKey || receipt.providerKey === "unconfigured") {
    return { accepted: false, reasonCode: "route_switch_provider_invalid" };
  }
  if (receipt.providerKey !== expectedProvider.providerKey) {
    return { accepted: false, reasonCode: "route_switch_provider_mismatch" };
  }
  if (receipt.operationId !== input.operationId) {
    return { accepted: false, reasonCode: "route_switch_operation_mismatch" };
  }
  if (!validObservedAt(receipt.observedAt)) {
    return { accepted: false, reasonCode: "route_switch_observed_at_invalid" };
  }
  const observed = receipt.observed;
  if (!observed) {
    return { accepted: false, reasonCode: "route_switch_readback_missing" };
  }
  if (observed.siteId !== input.siteId) {
    return { accepted: false, reasonCode: "route_switch_site_mismatch" };
  }
  if (observed.deploymentRunId !== input.deploymentRunId) {
    return { accepted: false, reasonCode: "route_switch_deployment_mismatch" };
  }
  if (observed.targetRef !== input.targetRef) {
    return { accepted: false, reasonCode: "route_switch_target_mismatch" };
  }
  if (observed.routeHash !== input.routeHash) {
    return { accepted: false, reasonCode: "route_switch_hash_mismatch" };
  }
  return { accepted: true, reasonCode: "site_route_switched" };
}

function hashRoute(route: Record<string, unknown>): string {
  const canonical = {
    ...route,
    domains: [...(route.domains as string[])].sort(),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function validObservedAt(value: string | null): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
