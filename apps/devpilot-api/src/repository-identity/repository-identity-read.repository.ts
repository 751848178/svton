import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const identitySelect = {
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
} as const;

@Injectable()
export class RepositoryIdentityReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  state(teamId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: {
        onboardingStatus: true,
        repositoryIdentity: { select: identitySelect },
        repositoryConnection: true,
        repositoryAnalysisRuns: {
          where: { status: { in: ["queued", "running"] } },
          take: 1,
          select: { id: true },
        },
      },
    });
  }

  buildContext(teamId: string, projectId: string, releaseOrderId: string) {
    return this.prisma.releaseOrder.findFirst({
      where: { id: releaseOrderId, teamId, projectId },
      select: {
        id: true,
        project: {
          select: {
            repositoryIdentity: { select: identitySelect },
            repositoryConnection: true,
            applications: {
              where: { status: "active" },
              orderBy: { id: "asc" as const },
              select: {
                id: true,
                name: true,
                repoPath: true,
                services: {
                  where: { status: "active" },
                  orderBy: { id: "asc" as const },
                  select: {
                    id: true,
                    releaseComponentKey: true,
                    name: true,
                    deployConfig: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
