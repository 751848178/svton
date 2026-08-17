import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SiteFinalProbeService } from "../site/site-final-probe.service";
import { SiteProbeLocalAcceptancePolicy } from "../site/site-probe-local-acceptance.policy";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import { Prisma } from "@prisma/client";

@Injectable()
export class ReleaseProductionDnsProbeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly probes: SiteFinalProbeService,
    private readonly localAcceptance: SiteProbeLocalAcceptancePolicy,
  ) {}

  async collect(input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    configRevisionId: string;
    routeSnapshot: unknown;
    deploymentInputHash: string;
    workloadInputHash: string;
    providerKey: string;
  }) {
    if (input.providerKey !== "local-filesystem-v1") return null;
    const route = record(input.routeSnapshot);
    const primaryDomain = firstDomain(route);
    const tlsRequired = route.tlsRequired === false ? false : true;
    const profile = this.localAcceptance.profile(primaryDomain, tlsRequired);
    if (!profile || !primaryDomain) return null;
    const routeHash = hashCanonicalReleaseValue(route);
    const sampledBucket = timeBucket(new Date());
    const reusable = await this.prisma.siteDnsProbeReceipt.findFirst({
      where: {
        ...scope(input), providerKey: input.providerKey,
        providerProfile: profile, routeHash,
        deploymentInputHash: input.deploymentInputHash,
        workloadInputHash: input.workloadInputHash,
        expiresAt: { gte: new Date() },
      },
      orderBy: [{ probedAt: "desc" }, { id: "desc" }],
    });
    if (reusable) return reusable;
    const result = await this.probes.probe({
      ...scope(input),
      deploymentRunId: `preflight:${input.deploymentInputHash}`,
      primaryDomain,
      tlsRequired,
    });
    const status = result.dns.status === "resolved"
      ? "resolved"
      : "unavailable";
    const probedAt = new Date(result.probedAt);
    const data = {
        ...scope(input), providerKey: input.providerKey,
        sampledBucket,
        providerProfile: profile, routeHash,
        deploymentInputHash: input.deploymentInputHash,
        workloadInputHash: input.workloadInputHash,
        status, resultHash: hashCanonicalReleaseValue(result),
        result: result as unknown as Prisma.InputJsonValue,
        probedAt, expiresAt: new Date(probedAt.getTime() + 15 * 60_000),
    };
    try {
      return await this.prisma.siteDnsProbeReceipt.create({ data });
    } catch (cause) {
      if (!(cause instanceof Prisma.PrismaClientKnownRequestError) || cause.code !== "P2002") {
        throw cause;
      }
      const exact = await this.prisma.siteDnsProbeReceipt.findFirst({ where: {
        deploymentInputHash: input.deploymentInputHash,
        workloadInputHash: input.workloadInputHash,
        routeHash,
        providerKey: input.providerKey,
        sampledBucket,
      } });
      if (!exact) throw cause;
      return exact;
    }
  }


  findFresh(input: Parameters<ReleaseProductionDnsProbeService["collect"]>[0]) {
    if (input.providerKey !== "local-filesystem-v1") return null;
    const route = record(input.routeSnapshot);
    const primaryDomain = firstDomain(route);
    const profile = this.localAcceptance.profile(
      primaryDomain,
      route.tlsRequired === false ? false : true,
    );
    if (!profile || !primaryDomain) return null;
    return this.prisma.siteDnsProbeReceipt.findFirst({
      where: {
        ...scope(input), providerKey: input.providerKey,
        providerProfile: profile,
        routeHash: hashCanonicalReleaseValue(route),
        deploymentInputHash: input.deploymentInputHash,
        workloadInputHash: input.workloadInputHash,
        expiresAt: { gte: new Date() },
      },
      orderBy: [{ probedAt: "desc" }, { id: "desc" }],
    });
  }
}

function timeBucket(now: Date) {
  const interval = 15 * 60_000;
  return new Date(Math.floor(now.getTime() / interval) * interval);
}

function scope(input: {
  teamId: string; projectId: string; environmentId: string; configRevisionId: string;
}) {
  return { teamId: input.teamId, projectId: input.projectId,
    environmentId: input.environmentId, configRevisionId: input.configRevisionId };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function firstDomain(route: Record<string, unknown>) {
  return Array.isArray(route.domains) && typeof route.domains[0] === "string"
    ? route.domains[0]
    : null;
}
