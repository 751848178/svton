import { ServerExecutorAuditService } from "./server-executor-audit.service";
import { rehydrateServerExecutionInput } from "./server-executor-input-snapshot.utils";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import { ServerExecutorQueueClaimService } from "./server-executor-queue-claim.service";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

export type ProcessQueuedJobResult = {
  processed: boolean;
  jobId?: string;
  status?: string;
  retryJobId?: string;
};

type ClaimedQueuedJob = NonNullable<
  Awaited<ReturnType<ServerExecutorQueueClaimService["claimNextQueuedJob"]>>
>;

type RunExecutionWithJob = (
  input: ServerExecutionInput,
  job: { id: string; attempt: number; maxAttempts: number },
) => Promise<ServerExecutionResult>;

type RecoverStaleRunningJobs = (
  teamId?: string,
  actorId?: string,
) => Promise<unknown>;

export class ServerExecutorQueuedJobProcessingService {
  constructor(
    private readonly queueClaimService: ServerExecutorQueueClaimService,
    private readonly jobLifecycleWriteService: ServerExecutorJobLifecycleWriteService,
    private readonly auditService: ServerExecutorAuditService,
    private readonly recoverStaleRunningJobs: RecoverStaleRunningJobs,
    private readonly runExecutionWithJob: RunExecutionWithJob,
    private readonly queueRetryDelayMs: () => number,
  ) {}

  async processNextQueuedJob(
    teamId?: string,
    actorId?: string,
  ): Promise<ProcessQueuedJobResult> {
    await this.recoverStaleRunningJobs(teamId, actorId);

    const job = await this.queueClaimService.claimNextQueuedJob(teamId);
    if (!job) {
      return { processed: false };
    }

    const input = rehydrateServerExecutionInput(job.inputSnapshot, {
      teamId: job.teamId,
      userId: job.actorId || undefined,
      retryOfJobId: job.retryOfId || undefined,
      retryAttempt: job.attempt,
      maxAttempts: job.maxAttempts,
    });
    const result = await this.runExecutionWithJob(input, {
      id: job.id,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
    });
    const retryJob = await this.enqueueAutoRetryIfNeeded(job, result);
    if (actorId) {
      await this.auditService.writeExecutionJobAudit({
        job,
        actorId,
        action: "server_execution_job.process_next",
        risk: job.dryRun ? "low" : "medium",
        status: result.status,
        summary: `手动处理 Server executor queued job ${job.operationKey} ${result.status}`,
        metadata: {
          processedJobId: job.id,
          resultStatus: result.status,
          resultMode: result.mode,
          retryJobId: retryJob?.id,
          autoRetryQueued: retryJob !== null,
          error: result.error,
        },
      });
    }

    return {
      processed: true,
      jobId: job.id,
      status: result.status,
      retryJobId: retryJob?.id,
    };
  }

  private async enqueueAutoRetryIfNeeded(
    job: ClaimedQueuedJob,
    result: ServerExecutionResult,
  ) {
    if (!["failed", "blocked"].includes(result.status)) {
      return null;
    }

    if (job.attempt >= job.maxAttempts) {
      return null;
    }

    const input = rehydrateServerExecutionInput(job.inputSnapshot, {
      teamId: job.teamId,
      userId: job.actorId || undefined,
      retryOfJobId: job.id,
      retryAttempt: job.attempt + 1,
      maxAttempts: job.maxAttempts,
    });

    return this.jobLifecycleWriteService.enqueueJob(input, {
      retryOfId: job.id,
      attempt: job.attempt + 1,
      maxAttempts: job.maxAttempts,
      availableAt: new Date(Date.now() + this.queueRetryDelayMs()),
      autoRetry: true,
    });
  }
}
