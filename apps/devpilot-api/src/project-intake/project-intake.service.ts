import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { StartRepositoryAnalysisDto } from "../repository-analysis/dto/repository-analysis.dto";
import type { ConnectRepositoryDto } from "../repository-analysis/dto/repository-connection.dto";
import { RepositoryAnalysisRunService } from "../repository-analysis/repository-analysis-run.service";
import { RepositoryConnectionService } from "../repository-analysis/repository-connection.service";
import type {
  CreateProjectIntakeDraftDto,
  FinalizeProjectIntakeDto,
} from "./dto/project-intake.dto";
import type { ReviewRepositoryIntakeContractDto } from "./dto/repository-intake-review.dto";
import { RepositoryIntakeContractService } from "./repository-intake-contract.service";
import { RepositoryIntakeReviewService } from "./repository-intake-review.service";
import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";
import { intakeError } from "./project-intake-errors.utils";
import type { ProjectIntakeStatus } from "./project-intake.types";
import { ProjectRepositoryDuplicateGuardService } from "./project-repository-duplicate-guard.service";
import {
  assertProjectIntakeMutable,
  findProjectIntake,
  transitionProjectIntake,
} from "./project-intake-project.repository";

@Injectable()
export class ProjectIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly duplicateGuard: ProjectRepositoryDuplicateGuardService,
    private readonly connections: RepositoryConnectionService,
    private readonly runs: RepositoryAnalysisRunService,
    private readonly contracts: RepositoryIntakeContractService,
    private readonly reviews: RepositoryIntakeReviewService,
    private readonly finalization: ProjectIntakeFinalizationService,
  ) {}

  createDraft(
    teamId: string,
    actorId: string,
    dto: CreateProjectIntakeDraftDto,
  ) {
    return this.prisma.project.create({
      data: {
        teamId,
        createdById: actorId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        config: {
          origin: "imported",
          onboarding: { version: 1 },
        },
        onboardingStatus: "draft",
        onboardingRevision: 1,
      },
    });
  }

  credentialOptions(teamId: string, actorId: string) {
    return this.connections.listCredentialOptions(teamId, actorId);
  }

  async state(teamId: string, actorId: string, projectId: string) {
    const project = await findProjectIntake(this.prisma, teamId, projectId);
    const [repository, runs] = await Promise.all([
      this.connections.getState(teamId, actorId, projectId),
      this.runs.list(teamId, projectId),
    ]);
    return { project, repository, runs };
  }

  async connect(
    teamId: string,
    actorId: string,
    projectId: string,
    dto: ConnectRepositoryDto,
  ) {
    await this.assertMutable(teamId, projectId);
    await this.duplicateGuard.assertAvailable(
      teamId,
      projectId,
      dto.repositoryUrl,
    );
    const connection = await this.connections.connect(
      teamId,
      actorId,
      projectId,
      dto,
      (tx) => transitionProjectIntake(tx, teamId, projectId, "analyzing"),
    );
    return connection;
  }

  async startAnalysis(
    teamId: string,
    actorId: string,
    projectId: string,
    dto: StartRepositoryAnalysisDto,
  ) {
    await this.assertMutable(teamId, projectId);
    const run = await this.runs.start(teamId, actorId, projectId, dto);
    await this.transition(teamId, projectId, "analyzing");
    return run;
  }

  async retryAnalysis(
    teamId: string,
    actorId: string,
    projectId: string,
    runId: string,
  ) {
    await this.assertMutable(teamId, projectId);
    const run = await this.runs.retry(teamId, actorId, projectId, runId);
    await this.transition(teamId, projectId, "analyzing");
    return run;
  }

  async review(
    teamId: string,
    actorId: string,
    projectId: string,
    runId: string,
    dto: ReviewRepositoryIntakeContractDto,
  ) {
    await this.assertMutable(teamId, projectId);
    const result = await this.reviews.review(
      teamId,
      actorId,
      projectId,
      runId,
      dto,
      (tx) => transitionProjectIntake(tx, teamId, projectId, "review"),
    );
    return result;
  }

  contract(teamId: string, projectId: string, runId: string) {
    return this.contracts.read(teamId, projectId, runId);
  }

  async finalize(
    teamId: string,
    actorId: string,
    projectId: string,
    dto: FinalizeProjectIntakeDto,
  ) {
    await this.assertMutable(teamId, projectId);
    return this.finalization.finalize(teamId, actorId, projectId, dto);
  }

  private async assertMutable(
    teamId: string,
    projectId: string,
  ): Promise<void> {
    const project = await assertProjectIntakeMutable(
      this.prisma,
      teamId,
      projectId,
    );
    if (project.onboardingStatus === "ready")
      throw new ConflictException(
        intakeError(
          "PROJECT_INTAKE_ALREADY_FINALIZED",
          "项目接入已经完成",
          "请进入项目设置管理仓库和环境。",
        ),
      );
  }

  private async transition(
    teamId: string,
    projectId: string,
    status: ProjectIntakeStatus,
  ): Promise<void> {
    await transitionProjectIntake(this.prisma, teamId, projectId, status);
  }
}
