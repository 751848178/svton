import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const orderInclude = {
  _count: { select: { buildRuns: true, manifests: true, releaseRuns: true } },
} as const;

@Injectable()
export class ReleaseOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProject(teamId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, teamId, archivedAt: null },
      select: { id: true },
    });
  }

  findScoped(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.releaseOrder.findFirst({
      where: { id: releaseOrderId, teamId, projectId },
      include: {
        ...orderInclude,
        project: {
          select: {
            repositoryConnection: {
              select: {
                repositoryUrl: true,
                provider: true,
                status: true,
                defaultBranch: true,
                selectedBranch: true,
              },
            },
            repositoryIdentity: {
              select: {
                id: true,
                projectId: true,
                provider: true,
                canonicalKey: true,
                canonicalUrl: true,
                lockedAt: true,
                currentRevision: {
                  select: {
                    id: true,
                    revision: true,
                    defaultBranch: true,
                    reason: true,
                    createdAt: true,
                    identityId: true,
                    projectId: true,
                  },
                },
              },
            },
            environments: {
              where: {
                status: "active",
                baselineRole: { in: ["staging", "production"] },
              },
              select: { id: true, baselineRole: true },
            },
          },
        },
      },
    });
  }

  findByVersion(projectId: string, releaseVersion: string) {
    return this.prisma.releaseOrder.findUnique({
      where: { projectId_releaseVersion: { projectId, releaseVersion } },
      include: orderInclude,
    });
  }

  create(input: {
    teamId: string;
    projectId: string;
    actorId: string;
    releaseVersion: string;
    note: string | null;
  }) {
    return this.prisma.releaseOrder.create({
      data: {
        teamId: input.teamId,
        projectId: input.projectId,
        createdById: input.actorId,
        releaseVersion: input.releaseVersion,
        note: input.note,
      },
      include: orderInclude,
    });
  }
}
