import { Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import { ConfigService } from "@nestjs/config";
import { resolveConfiguredReleaseDeploymentProviderKey } from "../release-delivery/release-deployment-provider-profile";
import type { ProjectDirectoryQueryDto } from "./dto/project-directory-query.dto";
import { toProjectDirectoryItem } from "./project-directory-presenter.utils";
import { ProjectDirectoryRepository } from "./project-directory.repository";
import type {
  ProjectDirectoryItem,
  ProjectDirectoryResponse,
} from "./project-directory.types";

@Injectable()
export class ProjectDirectoryService {
  constructor(
    private readonly repository: ProjectDirectoryRepository,
    private readonly access: ControlAccessPolicyService,
    private readonly config: ConfigService,
  ) {}

  async list(
    teamId: string,
    actorId: string,
    query: ProjectDirectoryQueryDto,
  ): Promise<ProjectDirectoryResponse> {
    const records = await this.repository.list(teamId);
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
    const authorized = decisions
      .filter((decision) => decision.allowed)
      .map((decision) => toProjectDirectoryItem(
        decision.project,
        resolveConfiguredReleaseDeploymentProviderKey(this.config),
      ));
    const filtered = authorized
      .filter((project) => matchesQuery(project, query.query))
      .filter((project) => !query.status || project.status === query.status)
      .sort(compareProjects);
    return {
      scope: { teamId, actorId },
      items: filtered.slice(0, query.take),
      total: filtered.length,
      summary: {
        total: authorized.length,
        online: authorized.filter((project) => project.status === "online")
          .length,
        needsConfiguration: authorized.filter(
          (project) => project.status === "needs_configuration",
        ).length,
      },
    };
  }
}

function matchesQuery(project: ProjectDirectoryItem, input?: string): boolean {
  const query = input?.trim().toLocaleLowerCase();
  if (!query) return true;
  return [
    project.name,
    project.repository?.canonicalUrl,
    project.production.domain,
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}

function compareProjects(
  left: ProjectDirectoryItem,
  right: ProjectDirectoryItem,
) {
  const activity = right.activity.occurredAt.localeCompare(
    left.activity.occurredAt,
  );
  return activity || left.id.localeCompare(right.id);
}
