import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const PROJECT_DIRECTORY_SELECT =
  Prisma.validator<Prisma.ProjectSelect>()({
    id: true,
    name: true,
    description: true,
    onboardingStatus: true,
    onboardingRevision: true,
    onboardingFinalizedAt: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, name: true, email: true } },
    repositoryIdentity: {
      select: { provider: true, canonicalUrl: true, defaultBranch: true },
    },
    repositoryConnection: {
      select: {
        provider: true,
        defaultBranch: true,
        selectedBranch: true,
        commitSha: true,
        status: true,
      },
    },
    environments: {
      where: { status: "active" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
        baselineRole: true,
        identityLockedAt: true,
        currentConfigRevisionId: true,
        deploymentRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            dryRun: true,
            commitSha: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    },
    sites: {
      select: {
        id: true,
        primaryDomain: true,
        status: true,
        environmentId: true,
      },
    },
    proxyConfigs: { select: { id: true, domain: true, status: true } },
    repositoryAnalysisRuns: {
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, status: true, createdAt: true, finishedAt: true },
    },
    deploymentRuns: {
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, status: true, createdAt: true, finishedAt: true },
    },
    releasePlans: {
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        finishedAt: true,
      },
    },
    auditEvents: {
      orderBy: { occurredAt: "desc" },
      take: 3,
      select: {
        id: true,
        action: true,
        status: true,
        summary: true,
        occurredAt: true,
      },
    },
    _count: { select: { applications: true, applicationServices: true } },
  });

export type ProjectDirectoryRecord = Prisma.ProjectGetPayload<{
  select: typeof PROJECT_DIRECTORY_SELECT;
}>;

@Injectable()
export class ProjectDirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string, search?: string): Promise<ProjectDirectoryRecord[]> {
    const term = search?.trim();
    return this.prisma.project.findMany({
      where: {
        teamId,
        archivedAt: null,
        ...(term
          ? {
              OR: [
                { name: { contains: term } },
                { description: { contains: term } },
                {
                  repositoryIdentity: {
                    is: { canonicalUrl: { contains: term } },
                  },
                },
                {
                  repositoryConnection: {
                    is: { repositoryUrl: { contains: term } },
                  },
                },
                { sites: { some: { primaryDomain: { contains: term } } } },
                { proxyConfigs: { some: { domain: { contains: term } } } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: PROJECT_DIRECTORY_SELECT,
    });
  }
}
