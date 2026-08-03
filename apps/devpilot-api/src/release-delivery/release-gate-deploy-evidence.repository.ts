import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ReferencedResource,
  ReleaseGateDeployEvidence,
} from "./release-gate-deploy-evidence.types";

@Injectable()
export class ReleaseGateDeployEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
  ): Promise<ReleaseGateDeployEvidence> {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { teamId, projectId, baselineRole: "staging", status: "active" },
      select: {
        id: true, key: true, status: true, baselineRole: true,
        currentConfigRevision: {
          select: {
            id: true, projectId: true, environmentId: true, revision: true,
            snapshotHash: true, plainVariables: true, secretReferences: true,
            resourceReferences: true, routeSnapshot: true, policyReferences: true,
            createdAt: true,
          },
        },
        serverBindings: {
          where: { status: "active" },
          select: {
            id: true, status: true, updatedAt: true,
            server: { select: { id: true, status: true, updatedAt: true } },
          },
        },
      },
    });
    if (!environment) return emptyDeployEvidence();
    const revision = environment.currentConfigRevision;
    const secretIds = referenceIds(revision?.secretReferences);
    const references = resourceReferences(revision?.resourceReferences);
    const idsByKind = (kind: string) => references
      .filter((item) => item.kind === kind).map((item) => item.id);
    const managedIds = idsByKind("managed_resource");
    const [secrets, managed, instances, sites, cdn, deployments, connections, metrics, backups] =
      await Promise.all([
        this.prisma.secretKey.findMany({
          where: {
            id: { in: secretIds }, teamId,
            OR: [{ projectId: null }, { projectId }],
            AND: [{ OR: [{ environmentId: null }, { environmentId: environment.id }] }],
          },
          select: {
            id: true, projectId: true, environmentId: true,
            name: true, type: true, updatedAt: true,
          },
        }),
        this.prisma.managedResource.findMany({
          where: { id: { in: managedIds }, teamId, projectId },
          select: {
            id: true, projectId: true, environmentId: true,
            status: true, kind: true, lastSyncAt: true,
          },
        }),
        this.prisma.resourceInstance.findMany({
          where: { id: { in: idsByKind("resource_instance") }, teamId, projectId },
          select: {
            id: true, projectId: true, environmentId: true,
            status: true, updatedAt: true,
          },
        }),
        this.prisma.site.findMany({
          where: { id: { in: idsByKind("site") }, teamId, projectId },
          select: {
            id: true, projectId: true, environmentId: true,
            status: true, lastSyncAt: true,
          },
        }),
        this.prisma.cDNConfig.findMany({
          where: { id: { in: idsByKind("cdn_config") }, teamId, projectId },
          select: {
            id: true, projectId: true, environmentId: true,
            status: true, updatedAt: true,
          },
        }),
        this.prisma.deploymentRun.findMany({
          where: {
            teamId, projectId, environmentId: environment.id,
            artifactManifest: { is: { releaseOrderId } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 5,
          select: {
            id: true, environmentId: true, status: true, dryRun: true, targetType: true,
            artifactManifestId: true, finishedAt: true, createdAt: true,
          },
        }),
        this.prisma.resourceConnectionRun.findMany({
          where: { teamId, projectId, environmentId: environment.id, resourceId: { in: managedIds } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
          select: {
            id: true, resourceId: true, environmentId: true, status: true,
            dryRun: true, finishedAt: true, createdAt: true,
          },
        }),
        this.prisma.resourceMetricSnapshot.findMany({
          where: { teamId, projectId, environmentId: environment.id, resourceId: { in: managedIds } },
          orderBy: [{ sampledAt: "desc" }, { id: "desc" }],
          take: 50,
          select: {
            id: true, resourceId: true, environmentId: true,
            status: true, sampledAt: true, raw: true,
          },
        }),
        this.prisma.backupRun.findMany({
          where: { teamId, projectId, environmentId: environment.id, resourceId: { in: managedIds } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
          select: {
            id: true, resourceId: true, environmentId: true, status: true,
            dryRun: true, finishedAt: true, createdAt: true,
          },
        }),
      ]);
    const resources: ReferencedResource[] = [
      ...managed.map((item) => ({
        ...item,
        kind: "managed_resource",
        resourceKind: item.kind,
        observedAt: item.lastSyncAt,
      })),
      ...instances.map((item) => ({ ...item, kind: "resource_instance", observedAt: item.updatedAt })),
      ...sites.map((item) => ({ ...item, kind: "site", observedAt: item.lastSyncAt })),
      ...cdn.map((item) => ({ ...item, kind: "cdn_config", observedAt: item.updatedAt })),
    ];
    return { environment, secrets, resources, deployments, connections, metrics, backups };
  }
}

function referenceIds(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) =>
    item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
      ? [(item as { id: string }).id] : []) : [];
}

function resourceReferences(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as { id?: unknown; kind?: unknown };
    return typeof value.id === "string" && typeof value.kind === "string"
      ? [{ id: value.id, kind: value.kind }] : [];
  }) : [];
}

function emptyDeployEvidence(): ReleaseGateDeployEvidence {
  return {
    environment: null, secrets: [], resources: [], deployments: [],
    connections: [], metrics: [], backups: [],
  };
}
