import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SiteRouteActivationError } from "./site-probe-policy";
import {
  type FrozenRouteSnapshot,
  type SiteRouteActivationPort,
  type SiteRouteActivationResolveInput,
  type SiteRouteActivationResolveResult,
} from "./site-route-activation.types";
import { resolveFrozenRouteSite } from "./site-route-observation.resolver";
import { resolveFrozenRoute } from "./site-route-snapshot.policy";

@Injectable()
export class SiteRouteActivationService implements SiteRouteActivationPort {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    input: SiteRouteActivationResolveInput,
  ): Promise<SiteRouteActivationResolveResult> {
    if (!input.routeSnapshot) {
      return unavailable("route_not_frozen", [], [], null);
    }
    const preliminary = resolveFrozenRoute(input.routeSnapshot);
    if (preliminary.reasonCode !== "route_ready") {
      return unavailable(
        preliminary.reasonCode,
        preliminary.domains,
        preliminary.entries,
        preliminary.proxyTarget,
      );
    }
    const sites = await this.prisma.site.findMany({
      where: {
        teamId: input.teamId,
        projectId: input.projectId,
      },
      select: {
        id: true,
        environmentId: true,
        primaryDomain: true,
        aliases: true,
        status: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    const observation = resolveFrozenRouteSite({
      routeSnapshot: input.routeSnapshot,
      environmentId: input.environmentId,
      sites,
    });
    const route = observation.route;
    if (route?.reasonCode === "route_ready" && !observation.site) {
      throw new SiteRouteActivationError({
        code: "SITE_ROUTE_ACTIVATION_FAILED",
        message: "Production 路由没有唯一可用的活跃 Site",
        evidence: {
          routeSwitch: {
            version: 1,
            siteId: null,
            primaryDomain: null,
            proxyTarget: route.proxyTarget,
            domains: route.domains,
            entries: route.entries,
            status: "unavailable",
            reasonCode: observation.reasonCode,
          },
        },
      });
    }
    if (!route || observation.reasonCode !== "site_route_matched") {
      return unavailable(
        observation.reasonCode,
        route?.domains ?? [],
        route?.entries ?? [],
        route?.proxyTarget ?? null,
      );
    }
    const site = observation.site!;
    return {
      siteId: site.id,
      primaryDomain: site.primaryDomain,
      domains: route.domains,
      entries: route.entries,
      proxyTarget: route.proxyTarget,
      status: "matched",
      reasonCode: "site_route_matched",
    };
  }
}

function unavailable(
  reasonCode: SiteRouteActivationResolveResult["reasonCode"],
  domains: string[],
  entries: SiteRouteActivationResolveResult["entries"],
  proxyTarget: string | null,
): SiteRouteActivationResolveResult {
  return {
    siteId: null,
    primaryDomain: null,
    domains,
    entries,
    proxyTarget,
    status: "unavailable",
    reasonCode,
  };
}

export function frozenRouteSnapshot(
  value: unknown,
): FrozenRouteSnapshot | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as FrozenRouteSnapshot)
    : null;
}
