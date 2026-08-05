import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReferencedResource } from "./release-gate-deploy-evidence.types";
import type { ResourceReference } from "./release-gate-deploy-reference.utils";

@Injectable()
export class ReleaseGateDeployResourceEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    secretIds: string[];
    references: ResourceReference[];
  }) {
    const idsByKind = (kind: string) =>
      input.references
        .filter((item) => item.kind === kind)
        .map((item) => item.id);
    const [secrets, managed, instances, sites, cdn] = await Promise.all([
      this.prisma.secretKey.findMany({
        where: {
          id: { in: input.secretIds },
          teamId: input.teamId,
          OR: [{ projectId: null }, { projectId: input.projectId }],
          AND: [
            {
              OR: [
                { environmentId: null },
                { environmentId: input.environmentId },
              ],
            },
          ],
        },
        select: {
          id: true,
          projectId: true,
          environmentId: true,
          name: true,
          type: true,
          updatedAt: true,
        },
      }),
      this.prisma.managedResource.findMany({
        where: {
          id: { in: idsByKind("managed_resource") },
          teamId: input.teamId,
          projectId: input.projectId,
        },
        select: {
          id: true,
          projectId: true,
          environmentId: true,
          status: true,
          kind: true,
          lastSyncAt: true,
        },
      }),
      this.prisma.resourceInstance.findMany({
        where: {
          id: { in: idsByKind("resource_instance") },
          teamId: input.teamId,
          projectId: input.projectId,
        },
        select: {
          id: true,
          projectId: true,
          environmentId: true,
          status: true,
          updatedAt: true,
        },
      }),
      this.prisma.site.findMany({
        where: {
          id: { in: idsByKind("site") },
          teamId: input.teamId,
          projectId: input.projectId,
        },
        select: {
          id: true,
          projectId: true,
          environmentId: true,
          status: true,
          lastSyncAt: true,
        },
      }),
      this.prisma.cDNConfig.findMany({
        where: {
          id: { in: idsByKind("cdn_config") },
          teamId: input.teamId,
          projectId: input.projectId,
        },
        select: {
          id: true,
          projectId: true,
          environmentId: true,
          status: true,
          updatedAt: true,
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
      ...instances.map((item) => ({
        ...item,
        kind: "resource_instance",
        observedAt: item.updatedAt,
      })),
      ...sites.map((item) => ({
        ...item,
        kind: "site",
        observedAt: item.lastSyncAt,
      })),
      ...cdn.map((item) => ({
        ...item,
        kind: "cdn_config",
        observedAt: item.updatedAt,
      })),
    ];
    return { secrets, resources };
  }
}
