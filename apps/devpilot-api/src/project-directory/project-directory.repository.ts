import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PROJECT_DELIVERY_SUMMARY_SELECT } from "../release-delivery/project-delivery-summary.select";
import {
  type ProjectDirectoryActivityRecord,
  recentProjectActivity,
} from "./project-directory-activity.repository";

export const PROJECT_DIRECTORY_SELECT =
  Prisma.validator<Prisma.ProjectSelect>()({
    ...PROJECT_DELIVERY_SUMMARY_SELECT,
    onboardingStatus: true,
    onboardingRevision: true,
    onboardingFinalizedAt: true,
    createdAt: true,
    updatedAt: true,
  });

type ProjectDirectoryBaseRecord = Prisma.ProjectGetPayload<{
  select: typeof PROJECT_DIRECTORY_SELECT;
}>;
export type ProjectDirectoryRecord = ProjectDirectoryBaseRecord & {
  recentActivity: ProjectDirectoryActivityRecord;
};

@Injectable()
export class ProjectDirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(teamId: string): Promise<ProjectDirectoryRecord[]> {
    const [projects, activity] = await Promise.all([
      this.prisma.project.findMany({
        where: { teamId, archivedAt: null },
        orderBy: [{ id: "asc" }],
        select: PROJECT_DIRECTORY_SELECT,
      }),
      recentProjectActivity(this.prisma, teamId),
    ]);
    return projects.map((project) => ({
      ...project,
      recentActivity: activity.get(project.id) ?? {
        id: project.id, projectId: project.id, activityType: "project",
        status: project.onboardingStatus ?? "unknown", summary: null,
        occurredAt: project.updatedAt,
      },
    }));
  }
}
