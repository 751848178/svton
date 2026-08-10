import type {
  SiteRouteCurrentReceipt,
  SiteRouteSwitchInput,
  SiteRouteSwitchObservation,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

export const HTTP_ROUTE_PROVIDER_KEY = "http-route-control-v1";

export class RouteControlError extends Error {
  constructor(readonly reasonCode: string) {
    super(reasonCode);
  }
}

export function assertProductionCapability(value: unknown) {
  const record = objectValue(value);
  const capabilities = objectValue(record.capabilities);
  if (
    record.protocol !== "site-route-control" ||
    record.version !== 1 ||
    capabilities.observeCurrent !== true ||
    capabilities.expectedCurrentCas !== true ||
    capabilities.compensation !== true ||
    capabilities.clear !== true
  ) {
    throw new RouteControlError("route_switch_capability_mismatch");
  }
}

export function switchedReceipt(
  operationId: string,
  value: unknown,
  allowAbsent = false,
): SiteRouteSwitchReceipt {
  const record = objectValue(value);
  const observed = observation(record.observed);
  if (!validDate(record.observedAt) || (!allowAbsent && !observed)) {
    throw new RouteControlError("route_switch_readback_invalid");
  }
  return {
    version: 1,
    providerKey: HTTP_ROUTE_PROVIDER_KEY,
    operationId,
    status: "switched",
    reasonCode:
      allowAbsent && !observed ? "site_route_cleared" : "site_route_switched",
    observedAt: record.observedAt as string,
    observed,
  };
}

export function currentReceipt(value: unknown): SiteRouteCurrentReceipt {
  const record = objectValue(value);
  const observed = observation(record.observed);
  const route = routeInput(record.route);
  if (!validDate(record.observedAt) || Boolean(observed) !== Boolean(route)) {
    throw new RouteControlError("route_switch_current_readback_invalid");
  }
  return {
    version: 1,
    providerKey: HTTP_ROUTE_PROVIDER_KEY,
    status: route ? "observed" : "absent",
    reasonCode: route
      ? "site_route_current_observed"
      : "site_route_current_absent",
    observedAt: record.observedAt as string,
    observed,
    route,
  };
}

export function failedReceipt(
  operationId: string,
  reasonCode: string,
): SiteRouteSwitchReceipt {
  return {
    version: 1,
    providerKey: HTTP_ROUTE_PROVIDER_KEY,
    operationId,
    status: "failed",
    reasonCode,
    observedAt: null,
    observed: null,
  };
}

export function failureReason(error: unknown) {
  return error instanceof RouteControlError
    ? error.reasonCode
    : "route_switch_provider_request_failed";
}

function observation(value: unknown): SiteRouteSwitchObservation | null {
  const record = objectValue(value);
  if (Object.keys(record).length === 0) return null;
  const values = [
    record.siteId,
    record.deploymentRunId,
    record.targetRef,
    record.routeHash,
  ];
  if (values.some((item) => typeof item !== "string" || item.length === 0)) {
    return null;
  }
  return record as unknown as SiteRouteSwitchObservation;
}

function routeInput(value: unknown): SiteRouteSwitchInput | null {
  const record = objectValue(value);
  if (Object.keys(record).length === 0) return null;
  return record.version === 1 && typeof record.routeHash === "string"
    ? (record as unknown as SiteRouteSwitchInput)
    : null;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
