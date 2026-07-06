import type { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SshLiveServerExecutorAdapter } from "./adapters/ssh-live.adapter";
import type { JobQueuePort } from "./queue/job-queue.port";
import { ServerExecutorAuditService } from "./server-executor-audit.service";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import { ServerExecutorJobRetryService } from "./server-executor-job-retry.service";
import { ServerExecutorQueueClaimService } from "./server-executor-queue-claim.service";
import { ServerExecutorQueuedJobProcessingService } from "./server-executor-queued-job-processing.service";
import { ServerExecutorQueueWorkerService } from "./server-executor-queue-worker.service";
import { ServerExecutorRemoteExecutionMetadataService } from "./server-executor-remote-execution-metadata.service";
import { ServerExecutorStaleRemoteCleanupService } from "./server-executor-stale-remote-cleanup.service";
import { ServerExecutorStaleRunningJobRecoveryService } from "./server-executor-stale-running-job-recovery.service";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

type RunJob = (
  input: ServerExecutionInput,
  job: { id: string; attempt: number; maxAttempts: number },
) => Promise<ServerExecutionResult>;

type QueueGovernanceFactoryOptions = {
  workerId: string;
  jobQueue?: JobQueuePort;
  sshLiveAdapter: SshLiveServerExecutorAdapter;
  remoteExecutionMetadataService: ServerExecutorRemoteExecutionMetadataService;
  jobLifecycleWriteService: ServerExecutorJobLifecycleWriteService;
  auditService: ServerExecutorAuditService;
  executeInline: (
    input: ServerExecutionInput,
  ) => Promise<ServerExecutionResult>;
  recoverStaleRunningJobs: (
    teamId?: string,
    actorId?: string,
  ) => Promise<unknown>;
  runJob: RunJob;
  processNextQueuedJob: () => Promise<{ processed: boolean }>;
  lockExpiresAt: (now: Date) => Date;
  queueRetryDelayMs: () => number;
  queueRecoveryBatchSize: () => number;
  queueWorkerEnabled: () => boolean;
  queueWorkerIntervalMs: () => number;
  queueWorkerBatchSize: () => number;
  staleRemoteCleanupEnabled: () => boolean;
  logger: Pick<Logger, "error" | "log">;
};

export class ServerExecutorQueueGovernanceFactoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly options: QueueGovernanceFactoryOptions,
  ) {}

  create() {
    const jobRetryService = new ServerExecutorJobRetryService(
      this.prisma,
      this.options.jobLifecycleWriteService,
      this.options.auditService,
      this.options.executeInline,
    );
    const queueClaimService = new ServerExecutorQueueClaimService(
      this.prisma,
      this.options.workerId,
      this.options.lockExpiresAt,
      this.options.jobQueue,
    );
    const staleRemoteCleanupService =
      new ServerExecutorStaleRemoteCleanupService(
        this.options.staleRemoteCleanupEnabled,
        this.options.sshLiveAdapter,
        this.options.remoteExecutionMetadataService,
      );
    const staleRunningJobRecoveryService =
      new ServerExecutorStaleRunningJobRecoveryService(
        this.prisma,
        this.options.jobLifecycleWriteService,
        this.options.auditService,
        staleRemoteCleanupService,
        this.options.queueRecoveryBatchSize,
        this.options.queueRetryDelayMs,
      );
    const queuedJobProcessingService =
      new ServerExecutorQueuedJobProcessingService(
        queueClaimService,
        this.options.jobLifecycleWriteService,
        this.options.auditService,
        this.options.recoverStaleRunningJobs,
        this.options.runJob,
        this.options.queueRetryDelayMs,
      );
    const queueWorkerService = new ServerExecutorQueueWorkerService({
      workerId: this.options.workerId,
      enabled: this.options.queueWorkerEnabled,
      intervalMs: this.options.queueWorkerIntervalMs,
      batchSize: this.options.queueWorkerBatchSize,
      processNextQueuedJob: this.options.processNextQueuedJob,
      logger: this.options.logger,
    });

    return {
      jobRetryService,
      queueClaimService,
      staleRemoteCleanupService,
      staleRunningJobRecoveryService,
      queuedJobProcessingService,
      queueWorkerService,
    };
  }
}

export type ServerExecutorQueueGovernanceServices = ReturnType<
  ServerExecutorQueueGovernanceFactoryService["create"]
>;
