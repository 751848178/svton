import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseGatePromoteEvidence } from "./release-gate-promote-evidence.types";
@Injectable()
export class ReleaseGatePromoteEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    releaseRunId?: string,
    dnsProbeReceiptId?: string,
  ): Promise<ReleaseGatePromoteEvidence> {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: {
        teamId,
        projectId,
        baselineRole: "production",
        status: "active",
      },
      select: {
        id: true,
        currentConfigRevision: {
          select: { id: true, routeSnapshot: true, createdAt: true },
        },
        currentEnvironmentVersion: {
          select: {
            id: true,
            artifactManifestId: true,
            deploymentRunId: true,
            releaseRunId: true,
            effectiveAt: true,
          },
        },
        environmentVersions: {
          orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
          take: 10,
          select: {
            id: true,
            artifactManifestId: true,
            deploymentRunId: true,
            previousVersionId: true,
            effectiveAt: true,
            artifactManifest: {
              select: {
                id: true,
                digest: true,
                items: { select: { id: true, digest: true } },
              },
            },
            deploymentRun: {
              select: { id: true, status: true, dryRun: true },
            },
          },
        },
      },
    });
    if (!environment) return emptyPromoteEvidence();
    const where = { teamId, projectId, environmentId: environment.id };
    const [releaseRun, sites, alerts, logRuns, metrics, routeSwitchRuns, dnsReceipts] = await Promise.all([
      this.prisma.releaseRun.findFirst({
        where: {
          ...where,
          releaseOrderId,
          ...(releaseRunId ? { id: releaseRunId } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          environmentId: true,
          artifactManifestId: true,
          mode: true,
          status: true,
          inputHash: true,
          policySnapshot: true,
          routeSnapshot: true,
          finishedAt: true,
          createdAt: true,
          operationApproval: {
            select: {
              id: true,
              projectId: true,
              environmentId: true,
              status: true,
              inputHash: true,
              reviewedAt: true,
              consumedAt: true,
              expiresAt: true,
            },
          },
          deploymentRuns: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 5,
            select: {
              id: true,
              environmentId: true,
              status: true,
              dryRun: true,
              artifactManifestId: true,
              healthCheckUrl: true,
              result: true,
              finishedAt: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.site.findMany({
        where: { teamId, projectId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          environmentId: true,
          status: true,
          primaryDomain: true,
          aliases: true,
          tls: true,
          dns: true,
          lastSyncAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.alertEvent.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          environmentId: true,
          metric: true,
          severity: true,
          status: true,
          value: true,
          metadata: true,
          occurredAt: true,
        },
      }),
      this.prisma.logCollectionRun.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: {
          id: true,
          environmentId: true,
          status: true,
          dryRun: true,
          result: true,
          ingestedEntryCount: true,
          finishedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.resourceMetricSnapshot.findMany({
        where,
        orderBy: [{ sampledAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          environmentId: true,
          status: true,
          sampledAt: true,
          raw: true,
        },
      }),
      this.prisma.siteRouteSwitchRun.findMany({
        where: { teamId, projectId, ...(releaseRunId ? { releaseRunId } : {}) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          id: true, operationId: true, releaseRunId: true, deploymentRunId: true,
          targetRef: true, status: true, result: true, applyReceipt: true,
          promotionCandidateHash: true, promotionObservedAt: true,
          promotionProbeHash: true, promotionObservation: true, updatedAt: true,
        },
      }),
      this.prisma.siteDnsProbeReceipt.findMany({
        where: { ...where, id: dnsProbeReceiptId ?? "__missing_dns_receipt__" },
        orderBy: [{ probedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          id: true, configRevisionId: true, providerKey: true,
          providerProfile: true,
          routeHash: true, deploymentInputHash: true, workloadInputHash: true,
          status: true, resultHash: true, result: true, probedAt: true,
          expiresAt: true,
        },
      }),
    ]);
    return { environment, releaseRun, sites, alerts, logRuns, metrics,
      routeSwitchRuns, dnsReceipts };
  }
}

function emptyPromoteEvidence(): ReleaseGatePromoteEvidence {
  return {
    environment: null, releaseRun: null, sites: [], alerts: [], logRuns: [],
    metrics: [], routeSwitchRuns: [], dnsReceipts: [],
  };
}
