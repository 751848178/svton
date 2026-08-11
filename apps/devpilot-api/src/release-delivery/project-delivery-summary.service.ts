import { Injectable, NotFoundException } from "@nestjs/common";
import { presentProjectDeliverySummary } from "./project-delivery-summary.presenter";
import { ProjectDeliverySummaryRepository } from "./project-delivery-summary.repository";
import { ReleaseStagingExecutorPort } from "./release-staging.types";

@Injectable()
export class ProjectDeliverySummaryService {
  constructor(
    private readonly repository: ProjectDeliverySummaryRepository,
    private readonly executor: ReleaseStagingExecutorPort,
  ) {}

  async get(teamId: string, actorId: string, projectId: string) {
    const project = await this.repository.load(teamId, projectId);
    if (!project) throw new NotFoundException("Project not found");
    return presentProjectDeliverySummary(project, actorId, this.executor.providerKey);
  }
}
