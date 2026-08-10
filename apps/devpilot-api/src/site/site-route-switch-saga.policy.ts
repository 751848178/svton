import { createHash } from "node:crypto";
import type {
  SiteRouteCurrentReceipt,
  SiteRouteSwitchInput,
  SiteRouteSwitchProviderIdentity,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";
import { validateSiteRouteSwitchReceipt } from "./site-route-switch-receipt.policy";

export function verifiedCurrentRoute(
  receipt: SiteRouteCurrentReceipt,
  provider: SiteRouteSwitchProviderIdentity,
) {
  if (
    receipt.version !== provider.receiptVersion ||
    receipt.providerKey !== provider.providerKey ||
    !receipt.observedAt ||
    !Number.isFinite(Date.parse(receipt.observedAt))
  ) {
    throw new Error("SITE_ROUTE_CURRENT_RECEIPT_INVALID");
  }
  if (receipt.status === "absent" && !receipt.route && !receipt.observed) {
    return { previous: null, expectedCurrent: null };
  }
  if (receipt.status !== "observed" || !receipt.route || !receipt.observed) {
    throw new Error(`SITE_ROUTE_CURRENT_UNAVAILABLE:${receipt.reasonCode}`);
  }
  if (
    receipt.route.siteId !== receipt.observed.siteId ||
    receipt.route.deploymentRunId !== receipt.observed.deploymentRunId ||
    receipt.route.targetRef !== receipt.observed.targetRef ||
    receipt.route.routeHash !== receipt.observed.routeHash
  ) {
    throw new Error("SITE_ROUTE_CURRENT_RECEIPT_MISMATCH");
  }
  return { previous: receipt.route, expectedCurrent: receipt.observed };
}

export function routeWasApplied(
  desired: SiteRouteSwitchInput,
  receipt: SiteRouteSwitchReceipt,
  provider: SiteRouteSwitchProviderIdentity,
) {
  return validateSiteRouteSwitchReceipt(desired, receipt, provider).accepted;
}

export function compensationOperationId(operationId: string) {
  const digest = createHash("sha256").update(operationId).digest("hex");
  return `site-route-compensation:${digest}`;
}

export function compensationWasApplied(
  operationId: string,
  previous: SiteRouteSwitchInput | null,
  receipt: SiteRouteSwitchReceipt,
  provider: SiteRouteSwitchProviderIdentity,
) {
  if (
    receipt.version !== provider.receiptVersion ||
    receipt.providerKey !== provider.providerKey ||
    receipt.operationId !== operationId ||
    receipt.status !== "switched" ||
    !receipt.observedAt ||
    !Number.isFinite(Date.parse(receipt.observedAt))
  ) {
    return false;
  }
  if (!previous) return receipt.observed === null;
  return (
    receipt.observed?.siteId === previous.siteId &&
    receipt.observed.deploymentRunId === previous.deploymentRunId &&
    receipt.observed.targetRef === previous.targetRef &&
    receipt.observed.routeHash === previous.routeHash
  );
}

export function routeSwitchError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
