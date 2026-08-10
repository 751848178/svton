import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { SiteRouteSwitchAttemptPersistence } from "./site-route-switch.types";

@Injectable()
export class SiteRouteSwitchEvidenceRepository {
  async persist(
    tx: Prisma.TransactionClient,
    input: SiteRouteSwitchAttemptPersistence,
  ) {
    const { evidence } = input;
    const finishedAt = evidence.switchedAt
      ? new Date(evidence.switchedAt)
      : new Date();
    if (evidence.status === "switched") {
      const updated = await tx.site.updateMany({
        where: {
          id: evidence.siteId,
          teamId: evidence.teamId,
          projectId: evidence.projectId,
          environmentId: evidence.environmentId,
        },
        data: {
          dns: (input.dnsProbe ?? {}) as Prisma.InputJsonValue,
          tls: mergeTlsProbe(
            await currentSiteTls(tx, evidence.siteId),
            input.tlsProbe,
          ),
          routeSwitch: evidence as unknown as Prisma.InputJsonValue,
        },
      });
      if (updated.count === 0) {
        throw new Error(`SITE_ROUTE_SWITCH_CONFLICT: site ${evidence.siteId}`);
      }
    }
    await tx.siteRouteSwitchRun.create({
      data: {
        teamId: evidence.teamId,
        siteId: evidence.siteId,
        projectId: evidence.projectId,
        environmentId: evidence.environmentId,
        deploymentRunId: evidence.deploymentRunId,
        releaseRunId: evidence.releaseRunId,
        targetRef: evidence.targetRef,
        proxyTarget: evidence.proxyTarget,
        domains: evidence.domains,
        status: evidence.status,
        reasonCode: evidence.reasonCode,
        result: {
          routeSwitch: evidence,
          siteProbe: input.siteProbe ?? null,
        } as unknown as Prisma.InputJsonValue,
        startedAt: finishedAt,
        finishedAt,
      },
    });
  }
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
  probe: SiteRouteSwitchAttemptPersistence["tlsProbe"],
): Prisma.InputJsonValue {
  return { ...existing, probe: probe ?? null } as Prisma.InputJsonValue;
}
