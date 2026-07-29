import { Module } from "@nestjs/common";
import { AuditEventModule } from "../audit-event";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { LogCenterModule } from "../log-center/log-center.module";
import { OperationApprovalModule } from "../operation-approval";
import { PrismaModule } from "../prisma/prisma.module";
import { ResourceRequestModule } from "../resource-request/resource-request.module";
import { ServerExecutorModule } from "../server-executor";
import { DeploymentController } from "./deployment.controller";
import { DeploymentRunDetailController } from "./deployment-run-detail.controller";
import { DeploymentRunDetailRepository } from "./deployment-run-detail.repository";
import { DeploymentRunDetailService } from "./deployment-run-detail.service";
import { DeploymentAutoRollbackSchedulerService } from "./deployment-auto-rollback-scheduler.service";
import { DeploymentInitializationCheckpointService } from "./deployment-initialization-checkpoint.service";
import { DeploymentLogStreamBootstrapService } from "./deployment-log-stream-bootstrap.service";
import { DeploymentPostRollbackSmokeSchedulerService } from "./deployment-post-rollback-smoke-scheduler.service";
import { DeploymentService } from "./deployment.service";
import { ReleaseInitializationEvidenceService } from "./release-initialization-evidence.service";

@Module({
  imports: [
    PrismaModule,
    ServerExecutorModule,
    AuditEventModule,
    OperationApprovalModule,
    ControlAccessPolicyModule,
    ResourceRequestModule,
    LogCenterModule,
  ],
  controllers: [DeploymentController, DeploymentRunDetailController],
  providers: [
    DeploymentService,
    DeploymentRunDetailRepository,
    DeploymentRunDetailService,
    DeploymentInitializationCheckpointService,
    ReleaseInitializationEvidenceService,
    DeploymentLogStreamBootstrapService,
    DeploymentAutoRollbackSchedulerService,
    DeploymentPostRollbackSmokeSchedulerService,
  ],
  exports: [
    DeploymentService,
    ReleaseInitializationEvidenceService,
    DeploymentAutoRollbackSchedulerService,
    DeploymentPostRollbackSmokeSchedulerService,
  ],
})
export class DeploymentModule {}
