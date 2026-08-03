import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { ProjectDuplicateGuardService } from './project-duplicate-guard.service';
import { TeamModule } from '../team/team.module';
import { ProjectEnvironmentModule } from '../project-environment';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { RepositoryAnalysisModule } from '../repository-analysis/repository-analysis.module';

@Module({
  imports: [
    TeamModule,
    ProjectEnvironmentModule,
    ControlAccessPolicyModule,
    RepositoryAnalysisModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectDuplicateGuardService],
  exports: [ProjectService],
})
export class ProjectModule {}
