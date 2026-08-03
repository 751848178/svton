import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { TeamModule } from '../team/team.module';
import { ProjectEnvironmentModule } from '../project-environment';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { RepositoryAnalysisModule } from '../repository-analysis/repository-analysis.module';
import { ProjectArchiveService } from './project-archive.service';

@Module({
  imports: [
    TeamModule,
    ProjectEnvironmentModule,
    ControlAccessPolicyModule,
    RepositoryAnalysisModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectArchiveService],
  exports: [ProjectService],
})
export class ProjectModule {}
