import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
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
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
