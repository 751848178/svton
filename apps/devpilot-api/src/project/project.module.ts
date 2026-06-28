import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { TeamModule } from '../team/team.module';
import { ProjectEnvironmentModule } from '../project-environment';
import { ControlAccessPolicyModule } from '../control-access-policy';

@Module({
  imports: [TeamModule, ProjectEnvironmentModule, ControlAccessPolicyModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
