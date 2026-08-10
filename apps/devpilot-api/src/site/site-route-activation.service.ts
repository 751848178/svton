import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SiteRouteActivationError } from "./site-probe-policy";
import {
  type FrozenRouteSnapshot,
  type SiteRouteActivationPort,
  type SiteRouteActivationResolveInput,
  type SiteRouteActivationResolveResult,
} from "./site-route-activation.types";
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
    const route = resolveFrozenRoute(input.routeSnapshot);
    if (route.reasonCode !== "route_ready") {
      return unavailable(
        route.reasonCode,
        route.domains,
        route.entries,
        route.proxyTarget,
      );
    }
    const site = await this.prisma.site.findFirst({
      where: {
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        primaryDomain: { in: route.domains },
      },
      select: { id: true, primaryDomain: true, status: true },
      orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
    });
    if (!site) {
      const routeSwitch = {
        version: 1,
        siteId: null,
        primaryDomain: null,
        deploymentRunId: null,
        releaseRunId: null,
        targetRef: null,
        proxyTarget: route.proxyTarget,
        domains: route.domains,
        entries: route.entries,
        status: "unavailable",
        reasonCode: "site_not_found",
        switchedAt: null,
      };
      throw new SiteRouteActivationError({
        code: "SITE_ROUTE_ACTIVATION_FAILED",
        message: "Production 路由声明了域名，但没有可切换的匹配 Site",
        evidence: { routeSwitch },
      });
    }
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
