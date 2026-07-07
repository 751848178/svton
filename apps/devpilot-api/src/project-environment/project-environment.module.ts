import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { SiteModule } from '../site';
import { ProjectEnvironmentController } from './project-environment.controller';
import { ProjectEnvironmentService } from './project-environment.service';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { ProjectEnvironmentCopySiteService } from './project-environment-copy-site.service';
import { ProjectEnvironmentSyncService } from './project-environment-sync.service';
import { ProjectEnvironmentSyncApplyService } from './project-environment-sync-apply.service';

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule, SiteModule],
  controllers: [ProjectEnvironmentController],
  providers: [ProjectEnvironmentService, ProjectEnvironmentRepository, ProjectEnvironmentCopySiteService, ProjectEnvironmentSyncService, ProjectEnvironmentSyncApplyService],
  exports: [ProjectEnvironmentService],
})
export class ProjectEnvironmentModule {}
