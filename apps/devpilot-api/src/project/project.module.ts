import { Module } from "@nestjs/common";
import { ProjectService } from "./project.service";
import { ProjectController } from "./project.controller";
import { TeamModule } from "../team/team.module";
import { ProjectEnvironmentModule } from "../project-environment";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { RepositoryAnalysisModule } from "../repository-analysis/repository-analysis.module";
import { ProjectArchiveService } from "./project-archive.service";
import { GeneratedProjectDraftService } from "./generated-project-draft.service";
import { ProjectGovernanceFinalizationService } from "./project-governance-finalization.service";
import { ProjectGovernanceBaselineService } from "./project-governance-baseline.service";
import { ProjectDuplicateGuardService } from "./project-duplicate-guard.service";

@Module({
  imports: [
    TeamModule,
    ProjectEnvironmentModule,
    ControlAccessPolicyModule,
    RepositoryAnalysisModule,
  ],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    ProjectArchiveService,
    GeneratedProjectDraftService,
    ProjectGovernanceBaselineService,
    ProjectGovernanceFinalizationService,
    ProjectDuplicateGuardService,
  ],
  exports: [
    ProjectService,
    GeneratedProjectDraftService,
    ProjectGovernanceFinalizationService,
  ],
})
export class ProjectModule {}
