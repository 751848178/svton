import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReleaseGateDeployOperationEvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(input: {
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    environmentId: string;
    manifestId?: string;
    deploymentRunId?: string;
    skipDeployments: boolean;
    managedResourceIds: string[];
  }) {
    const scope = {
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
    };
    const resourceScope = {
      ...scope,
      resourceId: { in: input.managedResourceIds },
    };
    const [deployments, connections, metrics, backups] = await Promise.all([
      input.skipDeployments
        ? Promise.resolve([])
        : this.prisma.deploymentRun.findMany({
            where: {
              ...scope,
              ...(input.deploymentRunId ? { id: input.deploymentRunId } : {}),
              artifactManifest: {
                is: {
                  releaseOrderId: input.releaseOrderId,
                  ...(input.manifestId ? { id: input.manifestId } : {}),
                },
              },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 5,
            select: {
              id: true,
              environmentId: true,
              status: true,
              dryRun: true,
              targetType: true,
              artifactManifestId: true,
              finishedAt: true,
              createdAt: true,
            },
          }),
      this.prisma.resourceConnectionRun.findMany({
        where: resourceScope,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          resourceId: true,
          environmentId: true,
          status: true,
          dryRun: true,
          finishedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.resourceMetricSnapshot.findMany({
        where: resourceScope,
        orderBy: [{ sampledAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          resourceId: true,
          environmentId: true,
          status: true,
          sampledAt: true,
          raw: true,
        },
      }),
      this.prisma.backupRun.findMany({
        where: resourceScope,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          resourceId: true,
          environmentId: true,
          status: true,
          dryRun: true,
          finishedAt: true,
          createdAt: true,
        },
      }),
    ]);
    return { deployments, connections, metrics, backups };
  }
}
