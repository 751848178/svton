/**
 * 发布编排模块（F383）。独立模块，不把逻辑塞进 DeploymentService。
 */
import { Module } from "@nestjs/common";
import { DeploymentModule } from "../deployment/deployment.module";
import { ServerExecutorModule } from "../server-executor/server-executor.module";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { AuditEventModule } from "../audit-event";
import { OperationApprovalModule } from "../operation-approval";
import { PrismaModule } from "../prisma/prisma.module";
import { ReleasePlanController } from "./release-plan.controller";
import { ReleasePlanService } from "./release-plan.service";
import { ReleaseCoordinatorService } from "./release-coordinator.service";
import { RELEASE_COORDINATOR_PORT } from "./release-coordinator.port";
import { ReleaseStageClaimService } from "./release-stage-claim.service";
import { ReleaseRecoveryService } from "./release-recovery.service";
import { ReleaseRecoverySchedulerService } from "./release-recovery-scheduler.service";
import { ReleaseReadinessService } from "./release-readiness.service";
import { ReleaseApprovalLifecycleService } from "./release-approval-lifecycle.service";
import { ReleasePlanRepository } from "./repository/release-plan.repository";
import { ReleaseStageRepository } from "./repository/release-stage.repository";
import { ReleaseStageAttemptRepository } from "./repository/release-stage-attempt.repository";
import { ReleaseConcurrencyLeaseRepository } from "./repository/release-concurrency-lease.repository";
import { ReleaseEventRepository } from "./repository/release-event.repository";
import { ServerCommandStageAdapter } from "./stage-adapters/server-command.adapter";
import { DeploymentRunStageAdapter } from "./stage-adapters/deployment-run.adapter";
import { HealthCheckStageAdapter } from "./stage-adapters/health-check.adapter";
import { ManualGateStageAdapter } from "./stage-adapters/manual-gate.adapter";

@Module({
  imports: [
    PrismaModule,
    DeploymentModule,
    ServerExecutorModule,
    ControlAccessPolicyModule,
    AuditEventModule,
    OperationApprovalModule,
  ],
  controllers: [ReleasePlanController],
  providers: [
    ReleasePlanService,
    ReleaseCoordinatorService,
    // 把 port token 绑定到 ReleaseCoordinatorService（useExisting，对齐 JOB_QUEUE_PORT 模式）。
    // ServerExecutorModule @Optional() 注入此 token；flag 关闭时为 undefined。
    { provide: RELEASE_COORDINATOR_PORT, useExisting: ReleaseCoordinatorService },
    ReleaseStageClaimService,
    ReleaseRecoveryService,
    ReleaseRecoverySchedulerService,
    ReleaseReadinessService,
    ReleaseApprovalLifecycleService,
    ReleasePlanRepository,
    ReleaseStageRepository,
    ReleaseStageAttemptRepository,
    ReleaseConcurrencyLeaseRepository,
    ReleaseEventRepository,
    ServerCommandStageAdapter,
    DeploymentRunStageAdapter,
    HealthCheckStageAdapter,
    ManualGateStageAdapter,
  ],
  exports: [ReleasePlanService, ReleaseCoordinatorService, RELEASE_COORDINATOR_PORT],
})
export class ReleaseOrchestrationModule {}
