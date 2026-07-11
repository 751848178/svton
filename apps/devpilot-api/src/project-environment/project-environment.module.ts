import { Module } from "@nestjs/common";
import { AuditEventModule } from "../audit-event";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { SiteModule } from "../site";
import {
  ProjectEnvironmentReadController,
  ProjectEnvironmentWriteController,
} from "./project-environment.controller";
import { ProjectEnvironmentService } from "./project-environment.service";
import { ProjectEnvironmentRepository } from "./project-environment.repository";
import { ProjectEnvironmentCopySiteService } from "./project-environment-copy-site.service";
import { ProjectEnvironmentSyncService } from "./project-environment-sync.service";
import { ProjectEnvironmentSyncApplyService } from "./project-environment-sync-apply.service";
import { ProjectEnvironmentResourceCopyService } from "./project-environment-resource-copy.service";
import { ProjectEnvironmentCdnCopyService } from "./project-environment-cdn-copy.service";
import { ProjectEnvironmentBulkBindService } from "./project-environment-bulk-bind.service";
import { ProjectEnvironmentDefaultsService } from "./project-environment-defaults.service";
import { ProjectEnvironmentServerBindingService } from "./project-environment-server-binding.service";
import { ProjectEnvironmentCrudService } from "./project-environment-crud.service";
import { ProjectEnvironmentCopyAccessPolicyService } from "./project-environment-copy-access-policy.service";
import { ProjectEnvironmentReadAccessPolicyService } from "./project-environment-read-access-policy.service";
import { ProjectEnvironmentWriteAccessPolicyService } from "./project-environment-write-access-policy.service";

@Module({
  imports: [
    PrismaModule,
    AuditEventModule,
    ControlAccessPolicyModule,
    SiteModule,
  ],
  controllers: [
    ProjectEnvironmentReadController,
    ProjectEnvironmentWriteController,
  ],
  providers: [
    ProjectEnvironmentService,
    ProjectEnvironmentRepository,
    ProjectEnvironmentCopySiteService,
    ProjectEnvironmentSyncService,
    ProjectEnvironmentSyncApplyService,
    ProjectEnvironmentResourceCopyService,
    ProjectEnvironmentCdnCopyService,
    ProjectEnvironmentBulkBindService,
    ProjectEnvironmentDefaultsService,
    ProjectEnvironmentServerBindingService,
    ProjectEnvironmentCrudService,
    ProjectEnvironmentReadAccessPolicyService,
    ProjectEnvironmentWriteAccessPolicyService,
    ProjectEnvironmentCopyAccessPolicyService,
  ],
  exports: [ProjectEnvironmentService],
})
export class ProjectEnvironmentModule {}
