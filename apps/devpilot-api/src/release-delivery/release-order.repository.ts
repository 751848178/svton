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
