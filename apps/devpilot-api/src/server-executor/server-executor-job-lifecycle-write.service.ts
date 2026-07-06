import { PrismaService } from "../prisma/prisma.service";
import { JobQueuePort } from "./queue/job-queue.port";
import {
  buildServerExecutorFailureLogs,
  readServerExecutorFailureMessage,
} from "./server-executor-failure-result.utils";
import { buildServerExecutionInputSnapshot } from "./server-executor-input-snapshot.utils";
import {
  buildInlineServerExecutionJobMetadata,
  buildQueuedServerExecutionJobInputSnapshot,
  buildQueuedServerExecutionJobMetadata,
  resolveInlineServerExecutionJobAttempt,
  resolveQueuedServerExecutionJobAttempt,
} from "./server-executor-job-attempt.utils";
import { buildServerExecutionJobInclude } from "./server-executor-job-include.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

type EnqueueExecutionJobOptions = {
  retryOfId?: string;
  attempt?: number;
  maxAttempts?: number;
  availableAt?: Date;
  autoRetry?: boolean;
};

export class ServerExecutorJobLifecycleWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workerId: string,
    private readonly lockExpiresAt: (now: Date) => Date,
    private readonly jobQueue?: JobQueuePort,
  ) {}

  async createInlineJob(input: ServerExecutionInput) {
    const attempt = resolveInlineServerExecutionJobAttempt(input);
    const now = new Date();

    return this.prisma.serverExecutionJob.create({
      data: {
        teamId: input.teamId,
        actorId: input.userId ?? undefined,
        serverId: input.target.serverId || undefined,
        retryOfId: attempt.retryOfId || undefined,
        operationKey: input.operationKey,
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        dryRun: input.dryRun,
        status: "running",
        queueMode: "inline",
        attempt: attempt.retryAttempt,
        maxAttempts: attempt.maxAttempts,
        availableAt: now,
        lockedAt: now,
        lockOwner: this.workerId,
        lockExpiresAt: this.lockExpiresAt(now),
        lastHeartbeatAt: now,
        inputSnapshot: buildServerExecutionInputSnapshot(input),
        metadata: buildInlineServerExecutionJobMetadata(input, attempt),
        startedAt: now,
      },
      select: { id: true, attempt: true, maxAttempts: true },
    });
  }

  async enqueueJob(
    input: ServerExecutionInput,
    options: EnqueueExecutionJobOptions = {},
  ) {
    const attempt = resolveQueuedServerExecutionJobAttempt(input, options);

    return this.prisma.serverExecutionJob.create({
      data: {
        teamId: input.teamId,
        actorId: input.userId ?? undefined,
        serverId: input.target.serverId || undefined,
        retryOfId: attempt.retryOfId || undefined,
        operationKey: input.operationKey,
        adapterKey: input.adapterKey,
        transport: input.target.transport,
        dryRun: input.dryRun,
        status: "queued",
        queueMode: "queued",
        attempt: attempt.retryAttempt,
        maxAttempts: attempt.maxAttempts,
        availableAt: options.availableAt || new Date(),
        inputSnapshot: buildQueuedServerExecutionJobInputSnapshot(
          input,
          attempt,
        ),
        metadata: buildQueuedServerExecutionJobMetadata(
          input,
          attempt,
          options,
        ),
      },
      include: buildServerExecutionJobInclude(),
    });
  }

  async finishJob(
    jobId: string,
    status: ServerExecutionResult["status"],
    result: ServerExecutionResult,
  ) {
    if (
      this.jobQueue &&
      (status === "completed" || status === "failed" || status === "cancelled")
    ) {
      await this.jobQueue.completeJob(jobId, status, {
        status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error,
      });
      return;
    }

    await this.prisma.serverExecutionJob.updateMany({
      where: { id: jobId },
      data: {
        status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error,
        lockedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        lastHeartbeatAt: null,
        cancelledAt: status === "cancelled" ? new Date() : undefined,
        finishedAt: new Date(),
      },
    });
  }

  async failJob(jobId: string, error: unknown) {
    const message = readServerExecutorFailureMessage(error);

    await this.prisma.serverExecutionJob.updateMany({
      where: { id: jobId },
      data: {
        status: "failed",
        error: message,
        logs: buildServerExecutorFailureLogs(message),
        lockedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        lastHeartbeatAt: null,
        finishedAt: new Date(),
      },
    });
  }
}
