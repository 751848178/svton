import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { REPOSITORY_ANALYSIS_ACTIVE_STATUSES } from "../repository-analysis/repository-analysis.constants";
import {
  activeProjectFinalizationArchiveError,
  activeRepositoryAnalysisArchiveError,
} from "./project-archive.error";

@Injectable()
export class ProjectArchiveService {
  constructor(private readonly prisma: PrismaService) {}

  archive(teamId: string, actorId: string, projectId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM Project
        WHERE id = ${projectId} AND teamId = ${teamId} FOR UPDATE`;
        const project = await tx.project.findFirst({
          where: { id: projectId, teamId },
          select: { id: true, name: true, archivedAt: true },
        });
        if (!project) throw new NotFoundException("项目不存在");
        if (project.archivedAt) {
          return {
            success: true,
            archivedAt: project.archivedAt,
            alreadyArchived: true,
          };
        }
        const activeRun = await tx.repositoryAnalysisRun.findFirst({
          where: {
            teamId,
            projectId,
            status: { in: [...REPOSITORY_ANALYSIS_ACTIVE_STATUSES] },
          },
          select: { id: true },
        });
        if (activeRun) throw activeRepositoryAnalysisArchiveError(activeRun.id);
        const activeFinalization = await tx.projectIntakeFinalization.findFirst({
          where: { teamId, projectId, status: "pending" },
          select: { id: true },
        });
        if (activeFinalization) {
          throw activeProjectFinalizationArchiveError(activeFinalization.id);
        }
        const archivedAt = new Date();
        const [environments, applications, services] = await Promise.all([
          tx.projectEnvironment.updateMany({
            where: { projectId, teamId, status: { not: "archived" } },
            data: { status: "archived" },
          }),
          tx.application.updateMany({
            where: { projectId, teamId, status: { not: "archived" } },
            data: { status: "archived" },
          }),
          tx.applicationService.updateMany({
            where: { projectId, teamId, status: { not: "archived" } },
            data: { status: "archived" },
          }),
        ]);
        await tx.project.update({
          where: { id: projectId },
          data: { archivedAt, onboardingStatus: "archived" },
        });
        const preserved = {
          environments: environments.count,
          applications: applications.count,
          services: services.count,
        };
        await tx.auditEvent.create({
          data: {
            teamId,
            actorId,
            projectId,
            category: "project",
            action: "project.archive",
            targetType: "project",
            targetId: projectId,
            risk: "high",
            status: "completed",
            summary: `归档项目 ${project.name}；历史运行和日志只读保留`,
            metadata: {
              archivedAt: archivedAt.toISOString(),
              preserved,
            } as Prisma.InputJsonValue,
          },
        });
        return { success: true, archivedAt, alreadyArchived: false, preserved };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
