import { Module } from "@nestjs/common";
import { AuditEventModule } from "../audit-event";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { ServerExecutorModule } from "../server-executor/server-executor.module";
import { AliyunSlsLogQueryAdapter } from "./aliyun-sls-log-query.adapter";
import { LogCenterAccessService } from "./log-center-access.service";
import { LogCenterAuditService } from "./log-center-audit.service";
import { LogCenterController } from "./log-center.controller";
import { LogCenterService } from "./log-center.service";
import { LogCollectionRunExecutionService } from "./log-collection-run-execution.service";
import { LogEntryAppendService } from "./log-entry-append.service";
import { LogEntryQueryService } from "./log-entry-query.service";
import { LogIngestionModule } from "./log-ingestion.module";
import { LogProviderCollectionPlanService } from "./log-provider-collection-plan.service";
import { LogRetentionCleanupService } from "./log-retention-cleanup.service";
import { LogRetentionSchedulerService } from "./log-retention-scheduler.service";
import { LogRunQueryService } from "./log-run-query.service";
import { LogServerCollectionExecutionService } from "./log-server-collection-execution.service";
import { LogServerFollowSchedulerService } from "./log-server-follow-scheduler.service";
import { LogSlsBackfillSchedulerService } from "./log-sls-backfill-scheduler.service";
import { LogStreamLinkedTargetContextService } from "./log-stream-linked-target-context.service";
import { LogStreamMutationService } from "./log-stream-mutation.service";
import { LogStreamSourceTargetContextService } from "./log-stream-source-target-context.service";
import { LogStreamQueryService } from "./log-stream-query.service";
import { LogStreamSessionAuditService } from "./log-stream-session-audit.service";
import { LogStreamSessionRegistry } from "./log-stream-session.registry";
import { LogStreamOperationsController } from "./log-stream-operations.controller";
import { LogStreamTailController } from "./log-stream-tail.controller";
import { LogStreamTargetContextService } from "./log-stream-target-context.service";
import { LogStreamWriteOrchestrationService } from "./log-stream-write-orchestration.service";

@Module({
  imports: [
    PrismaModule,
    AuditEventModule,
    ServerExecutorModule,
    ControlAccessPolicyModule,
    LogIngestionModule,
  ],
  controllers: [
    LogCenterController,
    LogStreamOperationsController,
    LogStreamTailController,
  ],
  providers: [
    LogCenterService,
    LogCenterAccessService,
    LogCenterAuditService,
    LogCollectionRunExecutionService,
    LogEntryAppendService,
    LogEntryQueryService,
    LogProviderCollectionPlanService,
    LogRetentionCleanupService,
    LogRetentionSchedulerService,
    LogRunQueryService,
    LogServerCollectionExecutionService,
    LogServerFollowSchedulerService,
    LogSlsBackfillSchedulerService,
    AliyunSlsLogQueryAdapter,
    LogStreamLinkedTargetContextService,
    LogStreamMutationService,
    LogStreamQueryService,
    LogStreamSourceTargetContextService,
    LogStreamTargetContextService,
    LogStreamWriteOrchestrationService,
    LogStreamSessionAuditService,
    LogStreamSessionRegistry,
  ],
  exports: [LogCenterService],
})
export class LogCenterModule {}
