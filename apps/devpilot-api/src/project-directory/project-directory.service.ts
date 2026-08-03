import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import type { ProjectDirectoryQueryDto } from "./dto/project-directory-query.dto";
import { toProjectDirectoryItem } from "./project-directory-presenter.utils";
import { ProjectDirectoryRepository } from "./project-directory.repository";

@Injectable()
export class ProjectDirectoryService {
  constructor(
    private readonly repository: ProjectDirectoryRepository,
    private readonly access: ControlAccessPolicyService,
  ) {}

  async list(teamId: string, actorId: string, query: ProjectDirectoryQueryDto) {
    const records = await this.repository.list(teamId, query.search);
    const decisions = await Promise.all(
      records.map(async (project) => ({
        project,
        allowed: await this.access.canRead({
          teamId,
          actorId,
          projectId: project.id,
          category: "project",
          action: "project.read",
          targetType: "project",
          targetId: project.id,
          risk: "low",
        }),
      })),
    );
    const filtered = decisions
      .filter((decision) => decision.allowed)
      .map((decision) => toProjectDirectoryItem(decision.project));
    const visible = filtered
      .filter(
        (project) =>
          !query.runtimeStatus || project.runtimeStatus === query.runtimeStatus,
      )
      .filter(
        (project) =>
          !query.configurationStatus ||
          project.configurationStatus === query.configurationStatus,
      )
      .sort((left, right) =>
        latestActivityAt(right).localeCompare(latestActivityAt(left)),
      );
    return {
      items: visible.slice(0, query.take),
      total: visible.length,
      summary: {
        total: filtered.length,
        online: filtered.filter(isProductionOnline).length,
        needsConfiguration: filtered.filter(
          (project) => project.configurationStatus !== "ready",
        ).length,
      },
    };
  }
}

function latestActivityAt(project: ReturnType<typeof toProjectDirectoryItem>) {
  return project.activity[0]?.occurredAt ?? project.updatedAt;
}

function isProductionOnline(
  project: ReturnType<typeof toProjectDirectoryItem>,
) {
  const deployment = project.production?.latestDeployment;
  return deployment?.status === "completed" && deployment.dryRun === false;
}
