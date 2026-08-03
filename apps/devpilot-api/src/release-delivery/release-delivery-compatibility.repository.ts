import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseDeliveryCompatibilitySnapshot } from "./release-delivery-migration-report.types";

@Injectable()
export class ReleaseDeliveryCompatibilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(
    teamId: string,
    projectId: string,
  ): Promise<ReleaseDeliveryCompatibilitySnapshot> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true, onboardingStatus: true, archivedAt: true },
    });
    if (!project) throw new NotFoundException("项目不存在");
    const [releasePlans, runs, environments, logStreams, logEntries] =
      await Promise.all([
        this.prisma.releasePlan.findMany({
          where: { teamId, projectId },
          select: { id: true, projectId: true, releaseOrderId: true },
        }),
        this.prisma.deploymentRun.findMany({
          where: { teamId, projectId },
          select: {
            id: true,
            projectId: true,
            status: true,
            artifactManifestId: true,
            result: true,
            logs: true,
            startedAt: true,
            environmentVersion: { select: { id: true } },
            _count: { select: { logStreams: true, logEntries: true } },
          },
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        }),
        this.prisma.projectEnvironment.findMany({
          where: { teamId, projectId },
          select: {
            id: true,
            projectId: true,
            currentEnvironmentVersionId: true,
            _count: {
              select: {
                deploymentRuns: { where: { status: "completed" } },
              },
            },
          },
        }),
        this.prisma.logStream.count({ where: { teamId, projectId } }),
        this.prisma.logEntry.count({ where: { teamId, projectId } }),
      ]);
    return {
      project,
      releasePlans,
      deploymentRuns: runs.map((run) => ({
        id: run.id,
        projectId: run.projectId,
        status: run.status,
        artifactManifestId: run.artifactManifestId,
        environmentVersionId: run.environmentVersion?.id,
        legacyArtifactDigest: legacyDigest(run.result),
      })),
      environments: environments.map((environment) => ({
        id: environment.id,
        projectId: environment.projectId,
        completedDeploymentRuns: environment._count.deploymentRuns,
        currentEnvironmentVersionId: environment.currentEnvironmentVersionId,
      })),
      history: runs.map((run) => ({
        id: run.id,
        status: run.status,
        artifactManifestId: run.artifactManifestId,
        logsRetained: Boolean(
          run.logs || run._count.logStreams || run._count.logEntries,
        ),
        startedAt: run.startedAt,
      })),
      logStreams,
      logEntries,
    };
  }
}

function legacyDigest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const digest = record.artifactDigest ?? record.manifestDigest;
  return typeof digest === "string" ? digest : null;
}
