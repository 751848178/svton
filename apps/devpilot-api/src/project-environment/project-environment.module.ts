import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteModule } from '../site';
import { ProjectEnvironmentController } from './project-environment.controller';
import { ProjectEnvironmentService } from './project-environment.service';

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule, SiteModule],
  controllers: [ProjectEnvironmentController],
  providers: [ProjectEnvironmentService],
  exports: [ProjectEnvironmentService],
})
export class ProjectEnvironmentModule {}
