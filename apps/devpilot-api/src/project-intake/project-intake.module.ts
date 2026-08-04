import { Module } from "@nestjs/common";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectModule } from "../project/project.module";
import { RepositoryAnalysisModule } from "../repository-analysis/repository-analysis.module";
import { RepositoryIdentityModule } from "../repository-identity/repository-identity.module";
import { ProjectIntakeAccessService } from "./project-intake-access.service";
import { ProjectIntakeController } from "./project-intake.controller";
import { ProjectIntakeFinalizationExecutorService } from "./project-intake-finalization-executor.service";
import { ProjectIntakeFinalizationRecordRepository } from "./project-intake-finalization-record.repository";
import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";
import { ProjectIntakeService } from "./project-intake.service";
import { RepositoryIntakeContractRepository } from "./repository-intake-contract.repository";
import { RepositoryIntakeContractService } from "./repository-intake-contract.service";
import { RepositoryIntakeReviewService } from "./repository-intake-review.service";
import { ProjectRepositoryDuplicateGuardService } from "./project-repository-duplicate-guard.service";
import { RepositoryIntakeSnapshotIntegrityService } from "./repository-intake-snapshot-integrity.service";

@Module({
  imports: [
    PrismaModule,
    ProjectModule,
    ControlAccessPolicyModule,
    RepositoryAnalysisModule,
    RepositoryIdentityModule,
  ],
  controllers: [ProjectIntakeController],
  providers: [
    ProjectIntakeService,
    RepositoryIntakeContractRepository,
    RepositoryIntakeContractService,
    RepositoryIntakeReviewService,
    ProjectIntakeAccessService,
    ProjectIntakeFinalizationService,
    ProjectIntakeFinalizationExecutorService,
    ProjectIntakeFinalizationRecordRepository,
    ProjectRepositoryDuplicateGuardService,
    RepositoryIntakeSnapshotIntegrityService,
  ],
  exports: [ProjectIntakeService],
})
export class ProjectIntakeModule {}
