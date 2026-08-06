import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SiteRouteActivationError } from "./site-probe-policy";
import {
  type FrozenRouteSnapshot,
  type SiteProbeBlock,
  type SiteProbeTlsBlock,
  type SiteRouteActivationPort,
  type SiteRouteActivationResolveInput,
  type SiteRouteActivationResolveResult,
  type SiteRouteSwitchApplyInput,
} from "./site-route-activation.types";

@Injectable()
export class SiteRouteActivationService implements SiteRouteActivationPort {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    input: SiteRouteActivationResolveInput,
  ): Promise<SiteRouteActivationResolveResult> {
    const route = routeSnapshot(input.routeSnapshot);
    const domains = stringList(route.domains);
    const proxyTarget = stringValue(route.proxyTarget);
    if (!input.routeSnapshot) {
      return unavailable("route_not_frozen", [], null);
    }
    if (domains.length === 0) {
      return unavailable("no_route_domains", [], null);
    }
    const site = await this.prisma.site.findFirst({
      where: {
        teamId: input.teamId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        primaryDomain: { in: domains },
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
        proxyTarget,
        domains,
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
      domains,
      proxyTarget,
      status: "matched",
      reasonCode: "site_route_matched",
    };
  }
}

export async function applySiteRouteSwitch(
  tx: Prisma.TransactionClient,
  input: SiteRouteSwitchApplyInput,
) {
  const finishedAt = new Date();
  const switched = await tx.site.updateMany({
    where: {
      id: input.siteId,
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
    },
    data: {
      dns: (input.dnsProbe ?? {}) as Prisma.InputJsonValue,
      tls: mergeTlsProbe(
        await currentSiteTls(tx, input.siteId),
        input.tlsProbe,
      ),
      routeSwitch: {
        version: 1,
        siteId: input.siteId,
        deploymentRunId: input.deploymentRunId,
        releaseRunId: input.releaseRunId ?? null,
        targetRef: input.targetRef ?? null,
        proxyTarget: input.proxyTarget ?? null,
        domains: input.domains,
        status: "switched",
        reasonCode: "site_switched",
        switchedAt: finishedAt.toISOString(),
      },
    },
  });
  if (switched.count === 0) {
    throw new Error(
      `SITE_ROUTE_SWITCH_CONFLICT: site ${input.siteId} is not bound to project/environment`,
    );
  }
  await tx.siteRouteSwitchRun.create({
    data: {
      teamId: input.teamId,
      siteId: input.siteId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      deploymentRunId: input.deploymentRunId,
      releaseRunId: input.releaseRunId ?? null,
      targetRef: input.targetRef ?? null,
      proxyTarget: input.proxyTarget ?? null,
      domains: input.domains,
      status: "switched",
      reasonCode: "site_switched",
      result: (input.result ?? {}) as Prisma.InputJsonValue,
      startedAt: finishedAt,
      finishedAt,
    },
  });
}

async function currentSiteTls(
  tx: Prisma.TransactionClient,
  siteId: string,
): Promise<Record<string, unknown>> {
  const site = await tx.site.findUnique({
    where: { id: siteId },
    select: { tls: true },
  });
  const tls = site?.tls;
  return tls && typeof tls === "object" && !Array.isArray(tls)
    ? (tls as Record<string, unknown>)
    : {};
}

function mergeTlsProbe(
  existing: Record<string, unknown>,
  tlsProbe: SiteRouteSwitchApplyInput["tlsProbe"],
): Prisma.InputJsonValue {
  return {
    ...existing,
    probe: tlsProbe ?? null,
  } as Prisma.InputJsonValue;
}

function unavailable(
  reasonCode: SiteRouteActivationResolveResult["reasonCode"],
  domains: string[],
  proxyTarget: string | null,
): SiteRouteActivationResolveResult {
  return {
    siteId: null,
    primaryDomain: null,
    domains,
    proxyTarget,
    status: "unavailable",
    reasonCode,
  };
}

function routeSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function frozenRouteSnapshot(
  value: unknown,
): FrozenRouteSnapshot | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as FrozenRouteSnapshot)
    : null;
}
