import type { FrozenRouteSnapshot } from "./site-route-activation.types";
import { resolveFrozenRoute } from "./site-route-snapshot.policy";

export type RouteObservedSite = {
  id: string;
  environmentId: string | null;
  status: string;
  primaryDomain: string;
  aliases: unknown;
  tls?: unknown;
  dns?: unknown;
  lastSyncAt?: Date | null;
  updatedAt: Date;
};

export function resolveFrozenRouteSite<S extends RouteObservedSite>(input: {
  routeSnapshot: FrozenRouteSnapshot | null;
  environmentId: string;
  sites: S[];
}) {
  if (!input.routeSnapshot) {
    return result("route_not_frozen", null, null);
  }
  const route = resolveFrozenRoute(input.routeSnapshot);
  if (route.reasonCode !== "route_ready") {
    return result(route.reasonCode, route, null);
  }
  const owners = route.domains.map((domain) =>
    input.sites.filter((site) => ownsDomain(site, domain)),
  );
  if (owners.some((candidates) => candidates.length === 0)) {
    return result("site_not_found", route, null);
  }
  const activeOwners = owners.map((candidates) =>
    candidates.filter((site) => site.status === "active"),
  );
  if (activeOwners.some((candidates) => candidates.length === 0)) {
    return result("site_not_active", route, null);
  }
  if (activeOwners.some((candidates) => candidates.length !== 1)) {
    return result("multiple_route_sites", route, null);
  }
  const sites = activeOwners.map((candidates) => candidates[0]!);
  if (sites.some((site) => site.environmentId !== input.environmentId)) {
    return result("site_environment_mismatch", route, null);
  }
  const unique = [...new Map(sites.map((site) => [site.id, site])).values()];
  if (unique.length !== 1) {
    return result("multiple_route_sites", route, null);
  }
  return result("site_route_matched", route, unique[0]);
}

function result<S extends RouteObservedSite>(
  reasonCode:
    | "route_not_frozen"
    | "no_route_domains"
    | "route_target_unverified"
    | "multiple_route_upstreams"
    | "site_not_found"
    | "site_environment_mismatch"
    | "site_not_active"
    | "multiple_route_sites"
    | "site_route_matched",
  route: ReturnType<typeof resolveFrozenRoute> | null,
  site: S | null,
) {
  return { reasonCode, route, site };
}

function ownsDomain(site: RouteObservedSite, domain: string) {
  const normalized = domain.toLowerCase();
  return site.primaryDomain.toLowerCase() === normalized ||
    aliases(site.aliases).some((alias) => alias.toLowerCase() === normalized);
}

function aliases(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
