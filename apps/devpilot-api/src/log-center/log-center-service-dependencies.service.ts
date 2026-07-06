import { AuditEventService } from "../audit-event";
import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutorService } from "../server-executor/server-executor.service";
import { AliyunSlsLogQueryAdapter } from "./aliyun-sls-log-query.adapter";
import { LogCenterAuditService } from "./log-center-audit.service";
import { LogCollectionRunExecutionService } from "./log-collection-run-execution.service";
import { LogCollectionIngestionService } from "./log-collection-ingestion.service";
import { LogEntryAppendService } from "./log-entry-append.service";
import { LogEntryQueryService } from "./log-entry-query.service";
import { LogProviderCollectionPlanService } from "./log-provider-collection-plan.service";
import { LogRetentionCleanupService } from "./log-retention-cleanup.service";
import { LogRunQueryService } from "./log-run-query.service";
import { LogServerCollectionExecutionService } from "./log-server-collection-execution.service";
import { LogStreamLinkedTargetContextService } from "./log-stream-linked-target-context.service";
import { LogStreamMutationService } from "./log-stream-mutation.service";
import { LogStreamQueryService } from "./log-stream-query.service";
import { LogStreamSourceTargetContextService } from "./log-stream-source-target-context.service";
import { LogStreamTargetContextService } from "./log-stream-target-context.service";
import { LogStreamWriteOrchestrationService } from "./log-stream-write-orchestration.service";

type LogCenterServiceDependencyOptions = {
  prisma: PrismaService;
  auditEventService: AuditEventService;
  serverExecutorService: ServerExecutorService;
  logCollectionIngestionService: LogCollectionIngestionService;
  aliyunSlsLogQueryAdapter: AliyunSlsLogQueryAdapter;
  logCenterAuditService?: LogCenterAuditService;
  logStreamTargetContextService?: LogStreamTargetContextService;
  logProviderCollectionPlanService?: LogProviderCollectionPlanService;
  logRetentionCleanupService?: LogRetentionCleanupService;
  logEntryAppendService?: LogEntryAppendService;
  logStreamMutationService?: LogStreamMutationService;
  logServerCollectionExecutionService?: LogServerCollectionExecutionService;
  logEntryQueryService?: LogEntryQueryService;
  logStreamQueryService?: LogStreamQueryService;
  logRunQueryService?: LogRunQueryService;
  logCollectionRunExecutionService?: LogCollectionRunExecutionService;
  logStreamWriteOrchestrationService?: LogStreamWriteOrchestrationService;
};

export type LogCenterServiceDependencies = {
  logStreamTargetContextService: LogStreamTargetContextService;
  logStreamMutationService: LogStreamMutationService;
  logEntryQueryService: LogEntryQueryService;
  logStreamQueryService: LogStreamQueryService;
  logRunQueryService: LogRunQueryService;
  logCollectionRunExecutionService: LogCollectionRunExecutionService;
  logStreamWriteOrchestrationService: LogStreamWriteOrchestrationService;
};

export function createLogCenterServiceDependencies({
  prisma,
  auditEventService,
  serverExecutorService,
  logCollectionIngestionService,
  aliyunSlsLogQueryAdapter,
  logCenterAuditService,
  logStreamTargetContextService,
  logProviderCollectionPlanService,
  logRetentionCleanupService,
  logEntryAppendService,
  logStreamMutationService,
  logServerCollectionExecutionService,
  logEntryQueryService,
  logStreamQueryService,
  logRunQueryService,
  logCollectionRunExecutionService,
  logStreamWriteOrchestrationService,
}: LogCenterServiceDependencyOptions): LogCenterServiceDependencies {
  const auditService =
    logCenterAuditService ?? new LogCenterAuditService(auditEventService);
  const targetContextService =
    logStreamTargetContextService ??
    new LogStreamTargetContextService(
      new LogStreamLinkedTargetContextService(prisma),
      new LogStreamSourceTargetContextService(prisma),
    );
  const retentionCleanupService =
    logRetentionCleanupService ??
    new LogRetentionCleanupService(prisma, auditService);
  const entryAppendService =
    logEntryAppendService ?? new LogEntryAppendService(prisma, auditService);
  const mutationService =
    logStreamMutationService ??
    new LogStreamMutationService(prisma, targetContextService);
  const serverCollectionExecutionService =
    logServerCollectionExecutionService ??
    new LogServerCollectionExecutionService(serverExecutorService);
  const providerCollectionPlanService =
    logProviderCollectionPlanService ??
    new LogProviderCollectionPlanService(aliyunSlsLogQueryAdapter);
  const entryQueryService =
    logEntryQueryService ?? new LogEntryQueryService(prisma);
  const streamQueryService =
    logStreamQueryService ?? new LogStreamQueryService(prisma);
  const runQueryService = logRunQueryService ?? new LogRunQueryService(prisma);
  const collectionRunExecutionService =
    logCollectionRunExecutionService ??
    new LogCollectionRunExecutionService(
      prisma,
      logCollectionIngestionService,
      auditService,
      serverCollectionExecutionService,
      providerCollectionPlanService,
    );
  const writeOrchestrationService =
    logStreamWriteOrchestrationService ??
    new LogStreamWriteOrchestrationService(
      streamQueryService,
      collectionRunExecutionService,
      mutationService,
      entryAppendService,
      retentionCleanupService,
    );

  return {
    logStreamTargetContextService: targetContextService,
    logStreamMutationService: mutationService,
    logEntryQueryService: entryQueryService,
    logStreamQueryService: streamQueryService,
    logRunQueryService: runQueryService,
    logCollectionRunExecutionService: collectionRunExecutionService,
    logStreamWriteOrchestrationService: writeOrchestrationService,
  };
}
