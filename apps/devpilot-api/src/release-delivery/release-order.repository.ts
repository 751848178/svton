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

  list(teamId: string, projectId: string) {
    return this.prisma.releaseOrder.findMany({
      where: { teamId, projectId },
      include: orderInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
              select: { status: true, defaultBranch: true },
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
