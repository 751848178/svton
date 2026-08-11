import type {
  FrozenRouteEntry,
  FrozenRouteSnapshot,
} from "./site-route-activation.types";

export type ResolvedFrozenRoute = {
  mode: "structured" | "legacy";
  domains: string[];
  entries: FrozenRouteEntry[];
  proxyTarget: string | null;
  reasonCode:
    | "route_ready"
    | "no_route_domains"
    | "route_target_unverified"
    | "multiple_route_upstreams";
};

export function resolveFrozenRoute(
  snapshot: FrozenRouteSnapshot,
): ResolvedFrozenRoute {
  if (Object.prototype.hasOwnProperty.call(snapshot, "entries")) {
    return resolveStructuredRoute(snapshot.entries);
  }
  const domains = uniqueStrings(snapshot.domains);
  const proxyTarget = stringValue(snapshot.proxyTarget);
  return {
    mode: "legacy",
    domains,
    entries: [],
    proxyTarget,
    reasonCode: domains.length === 0
      ? "no_route_domains"
      : proxyTarget
        ? "route_ready"
        : "route_target_unverified",
  };
}

function resolveStructuredRoute(value: unknown): ResolvedFrozenRoute {
  const sourceEntries = Array.isArray(value) ? value : [];
  const entries = Array.isArray(value)
    ? value.flatMap((entry) => normalizedEntry(entry))
    : [];
  const domains = [...new Set(entries.map((entry) => entry.domain))].sort();
  const upstreams = new Set(
    entries.map((entry) => `${entry.component}:${entry.port}`),
  );
  const reasonCode = domains.length === 0
    ? "no_route_domains"
    : entries.length === 0 || entries.length !== sourceEntries.length
      ? "route_target_unverified"
      : upstreams.size > 1
        ? "multiple_route_upstreams"
        : "route_ready";
  return {
    mode: "structured",
    domains,
    entries,
    proxyTarget: reasonCode === "route_ready" ? [...upstreams][0] : null,
    reasonCode,
  };
}

function normalizedEntry(value: unknown): FrozenRouteEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const entry = value as Record<string, unknown>;
  const domain = stringValue(entry.domain);
  const path = stringValue(entry.path) ?? "/";
  const serviceId = stringValue(entry.serviceId);
  const component = stringValue(entry.component);
  const port = entry.port;
  if (
    !domain || !serviceId || !component ||
    typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65_535
  ) return [];
  return [{
    domain,
    path,
    serviceId,
    component,
    port,
    tlsMode: entry.tlsMode === "existing_cert_asset"
      ? "existing_cert_asset"
      : "managed_cert",
  }];
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.flatMap((item) => stringValue(item) ?? []))].sort()
    : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
