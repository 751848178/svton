import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentTaskPullFinishDto } from "./dto/server-execution-lease.dto";
import { JobQueuePort, JOB_QUEUE_PORT } from "./queue/job-queue.port";
import {
  buildServerAgentTaskPullFinishSyncExecutionResult,
  buildServerAgentTaskPullLogCollectionSyncResult,
  isServerAgentTaskPullNonLogBusinessRunSync,
  readServerAgentTaskPullFinishSyncBusinessRunSync,
  readServerAgentTaskPullFinishSyncLogCollectionRunId,
  readServerAgentTaskPullFinishSyncMetadata,
  rehydrateServerAgentTaskPullPolicyBlockedSyncInput,
  rehydrateServerAgentTaskPullFinishSyncInput,
  type ServerAgentTaskPullFinishSyncJob,
} from "./server-agent-task-pull-finish-sync-result.utils";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import { ServerExecutorLinkedBusinessRunSyncFactoryService } from "./server-executor-linked-business-run-sync-factory.service";
import { ServerExecutorLinkedBusinessRunSyncService } from "./server-executor-linked-business-run-sync.service";
import { ServerExecutorLogCollectionRunSyncService } from "./server-executor-log-collection-run-sync.service";
import { buildServerExecutorQueuedResult } from "./server-executor-result.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

export type { ServerAgentTaskPullFinishSyncJob };

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
    const metadata = readServerAgentTaskPullFinishSyncMetadata(
      job.inputSnapshot,
    );
    const businessRunSync =
      readServerAgentTaskPullFinishSyncBusinessRunSync(metadata);
    const shouldSyncLogCollection = businessRunSync === "log_collection";
    const shouldSyncNonLog =
      isServerAgentTaskPullNonLogBusinessRunSync(businessRunSync);

    if (!shouldSyncLogCollection && !shouldSyncNonLog) return null;

    const input = rehydrateServerAgentTaskPullFinishSyncInput(dto, job);
    const result = buildServerAgentTaskPullFinishSyncExecutionResult(
      dto,
      input,
      job,
    );
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

  async syncAfterPolicyBlocked(
    teamId: string,
    job: ServerAgentTaskPullFinishSyncJob,
    result: ServerExecutionResult,
  ) {
    const metadata = readServerAgentTaskPullFinishSyncMetadata(
      job.inputSnapshot,
    );
    const businessRunSync =
      readServerAgentTaskPullFinishSyncBusinessRunSync(metadata);
    if (!businessRunSync) return null;

    const input = rehydrateServerAgentTaskPullPolicyBlockedSyncInput(
      job,
      teamId,
    );
    if (businessRunSync === "log_collection") {
      return this.syncLogCollectionRunAfterPolicyBlock(
        input,
        result,
        job,
        metadata,
      );
    }
    if (!isServerAgentTaskPullNonLogBusinessRunSync(businessRunSync)) {
      return null;
    }

    const synced = await this.linkedBusinessRunSyncService.syncAfterExecution(
      input,
      job.id,
      result,
    );
    return { businessRunSync, synced };
  }

  private async syncLogCollectionRun(
    dto: ServerAgentTaskPullFinishDto,
    input: ServerExecutionInput,
    result: ServerExecutionResult,
    job: ServerAgentTaskPullFinishSyncJob,
    metadata: Record<string, unknown>,
  ) {
    const logCollectionRunId =
      readServerAgentTaskPullFinishSyncLogCollectionRunId(metadata);
    if (!logCollectionRunId) return null;

    const synced = await this.logCollectionRunSyncService.syncAfterExecution(
      input,
      job.id,
      result,
      metadata,
    );

    return buildServerAgentTaskPullLogCollectionSyncResult(
      dto,
      logCollectionRunId,
      synced,
    );
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

  private async syncLogCollectionRunAfterPolicyBlock(
    input: ServerExecutionInput,
    result: ServerExecutionResult,
    job: ServerAgentTaskPullFinishSyncJob,
    metadata: Record<string, unknown>,
  ) {
    const logCollectionRunId =
      readServerAgentTaskPullFinishSyncLogCollectionRunId(metadata);
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
      completedIngestionAttempted: false,
    };
  }
}
