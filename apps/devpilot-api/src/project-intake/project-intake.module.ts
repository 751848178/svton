import { Module } from "@nestjs/common";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectModule } from "../project/project.module";
import { RepositoryAnalysisModule } from "../repository-analysis/repository-analysis.module";
import { ProjectIntakeAccessService } from "./project-intake-access.service";
import { ProjectIntakeController } from "./project-intake.controller";
import { ProjectIntakeFinalizationExecutorService } from "./project-intake-finalization-executor.service";
import { ProjectIntakeFinalizationRecordRepository } from "./project-intake-finalization-record.repository";
import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";
import { ProjectIntakeService } from "./project-intake.service";
import { ProjectRepositoryDuplicateGuardService } from "./project-repository-duplicate-guard.service";

@Module({
  imports: [
    PrismaModule,
    ProjectModule,
    ControlAccessPolicyModule,
    RepositoryAnalysisModule,
  ],
  controllers: [ProjectIntakeController],
  providers: [
    ProjectIntakeService,
    ProjectIntakeAccessService,
    ProjectIntakeFinalizationService,
    ProjectIntakeFinalizationExecutorService,
    ProjectIntakeFinalizationRecordRepository,
    ProjectRepositoryDuplicateGuardService,
  ],
  exports: [ProjectIntakeService],
})
export class ProjectIntakeModule {}
