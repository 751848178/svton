import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentTaskPullFinishDto } from "./dto/server-execution-lease.dto";
import { JobQueuePort, JOB_QUEUE_PORT } from "./queue/job-queue.port";
import { rehydrateServerExecutionInput } from "./server-executor-input-snapshot.utils";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import { ServerExecutorLinkedBusinessRunSyncFactoryService } from "./server-executor-linked-business-run-sync-factory.service";
import { ServerExecutorLinkedBusinessRunSyncService } from "./server-executor-linked-business-run-sync.service";
import {
  isRecord,
  readOptionalString,
  toJsonValue,
} from "./server-executor-json.utils";
import { ServerExecutorLogCollectionRunSyncService } from "./server-executor-log-collection-run-sync.service";
import { buildServerExecutorQueuedResult } from "./server-executor-result.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

export type ServerAgentTaskPullFinishSyncJob = {
  id: string;
  teamId: string;
  actorId: string | null;
  retryOfId: string | null;
  attempt: number;
  maxAttempts: number;
  adapterKey: string;
  inputSnapshot: Prisma.JsonValue;
};

const NON_LOG_BUSINESS_RUN_SYNC_TYPES = new Set([
  "deployment",
  "site_sync",
  "resource_action",
  "service_operation",
  "backup_run",
]);

@Injectable()
export class ServerAgentTaskPullFinishSyncService {
  private readonly logger = new Logger(
    ServerAgentTaskPullFinishSyncService.name,
  );
  private readonly jobLifecycleWriteService: ServerExecutorJobLifecycleWriteService;
  private readonly linkedBusinessRunSyncService: ServerExecutorLinkedBusinessRunSyncService;
  private readonly logCollectionRunSyncService: ServerExecutorLogCollectionRunSyncService;

  constructor(
    prisma: PrismaService,
    logCollectionIngestionService: LogCollectionIngestionService,
    @Optional()
    @Inject(JOB_QUEUE_PORT)
    private readonly jobQueue?: JobQueuePort,
  ) {
    this.jobLifecycleWriteService = new ServerExecutorJobLifecycleWriteService(
      prisma,
      "server-agent-task-pull-finish-sync",
      (now) => now,
      this.jobQueue,
    );
    this.logCollectionRunSyncService =
      new ServerExecutorLogCollectionRunSyncService(
        prisma,
        logCollectionIngestionService,
      );
    this.linkedBusinessRunSyncService =
      new ServerExecutorLinkedBusinessRunSyncFactoryService(
        prisma,
        logCollectionIngestionService,
        this.logger,
        (input, options) => this.queueLinkedSiteExecution(input, options),
      ).create();
  }

  async syncAfterFinish(
    dto: ServerAgentTaskPullFinishDto,
    job: ServerAgentTaskPullFinishSyncJob,
  ) {
    const metadata = this.readMetadata(job.inputSnapshot);
    const businessRunSync = readOptionalString(metadata.businessRunSync);
    const shouldSyncLogCollection = businessRunSync === "log_collection";
    const shouldSyncNonLog = this.isNonLogBusinessRunSync(businessRunSync);

    if (!shouldSyncLogCollection && !shouldSyncNonLog) return null;

    const input = this.rehydrateInput(dto, job);
    const result = this.buildExecutionResult(dto, input, job);
    if (shouldSyncLogCollection) {
      return this.syncLogCollectionRun(dto, input, result, job, metadata);
    }

    const synced = await this.linkedBusinessRunSyncService.syncAfterExecution(
      input,
      job.id,
      result,
    );

    return {
      businessRunSync,
      synced,
    };
  }

  private async syncLogCollectionRun(
    dto: ServerAgentTaskPullFinishDto,
    input: ServerExecutionInput,
    result: ServerExecutionResult,
    job: ServerAgentTaskPullFinishSyncJob,
    metadata: Record<string, unknown>,
  ) {
    const logCollectionRunId =
      readOptionalString(metadata.logCollectionRunId) || null;
    if (!logCollectionRunId) return null;

    const synced = await this.logCollectionRunSyncService.syncAfterExecution(
      input,
      job.id,
      result,
      metadata,
    );

    return {
      businessRunSync: "log_collection",
      logCollectionRunId,
      synced,
      completedIngestionAttempted: synced && dto.status === "completed",
    };
  }

  private readMetadata(snapshot: Prisma.JsonValue): Record<string, unknown> {
    if (!isRecord(snapshot)) return {};
    return isRecord(snapshot.metadata) ? snapshot.metadata : {};
  }

  private isNonLogBusinessRunSync(value: string | null | undefined) {
    return !!value && NON_LOG_BUSINESS_RUN_SYNC_TYPES.has(value);
  }

  private async queueLinkedSiteExecution(
    input: ServerExecutionInput,
    options: { maxAttempts?: number; availableAt?: Date } = {},
  ): Promise<ServerQueuedExecutionResult> {
    const job = await this.jobLifecycleWriteService.enqueueJob(input, {
      maxAttempts: options.maxAttempts,
      availableAt: options.availableAt,
    });

    return buildServerExecutorQueuedResult(input, {
      id: job.id,
      queuedAt: job.queuedAt,
      availableAt: job.availableAt,
    });
  }

  private rehydrateInput(
    dto: ServerAgentTaskPullFinishDto,
    job: ServerAgentTaskPullFinishSyncJob,
  ): ServerExecutionInput {
    return rehydrateServerExecutionInput(job.inputSnapshot, {
      teamId: dto.teamId,
      userId: job.actorId || undefined,
      retryOfJobId: job.retryOfId || undefined,
      retryAttempt: job.attempt,
      maxAttempts: job.maxAttempts,
    });
  }

  private buildExecutionResult(
    dto: ServerAgentTaskPullFinishDto,
    input: ServerExecutionInput,
    job: ServerAgentTaskPullFinishSyncJob,
  ): ServerExecutionResult {
    return {
      status: dto.status,
      mode: dto.status === "cancelled" ? "cancelled" : "executed",
      executorKey: "server-executor",
      adapterKey: job.adapterKey,
      executable: dto.status === "completed",
      warnings: input.warnings || [],
      commandSteps: input.steps,
      commandPlan: toJsonValue(dto.commandPlan ?? null),
      logs: toJsonValue(dto.logs ?? []),
      result: toJsonValue(
        dto.result ?? {
          mode: "agent_task_pull_terminal_writeback",
          serverExecutionJobId: job.id,
          status: dto.status,
        },
      ),
      error: dto.error,
    };
  }
}
