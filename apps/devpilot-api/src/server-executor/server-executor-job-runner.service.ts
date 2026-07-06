import { ServerCommandPolicyService } from "./server-command-policy.service";
import { ServerExecutorCancellationTokenService } from "./server-executor-cancellation-token.service";
import { buildServerExecutorPolicyBlockedResult } from "./server-executor-blocked-result.utils";
import {
  ServerExecutorExecutionRuntimeService,
  ServerExecutorRuntimeLease,
  ServerExecutorRuntimeLeaseLock,
} from "./server-executor-execution-runtime.service";
import { ServerExecutorAuditService } from "./server-executor-audit.service";
import { ServerExecutorJobCompletionService } from "./server-executor-job-completion.service";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import { ServerExecutorLinkedBusinessRunSyncService } from "./server-executor-linked-business-run-sync.service";
import { ServerExecutorRemoteExecutionMetadataService } from "./server-executor-remote-execution-metadata.service";
import { ServerExecutorRunningCancellationService } from "./server-executor-running-cancellation.service";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

export type ServerExecutorJobRunnerRecord = {
  id: string;
  attempt: number;
  maxAttempts: number;
};

type CancellationTokenLogger = {
  warn(message: string): void;
};

export class ServerExecutorJobRunnerService {
  constructor(
    private readonly commandPolicy: ServerCommandPolicyService,
    private readonly cancellationTokenService: ServerExecutorCancellationTokenService,
    private readonly runningCancellationService: ServerExecutorRunningCancellationService,
    private readonly executionRuntimeService: ServerExecutorExecutionRuntimeService,
    private readonly remoteExecutionMetadataService: ServerExecutorRemoteExecutionMetadataService,
    private readonly jobLifecycleWriteService: ServerExecutorJobLifecycleWriteService,
    private readonly linkedBusinessRunSyncService: ServerExecutorLinkedBusinessRunSyncService,
    private readonly jobCompletionService: ServerExecutorJobCompletionService,
    private readonly auditService: ServerExecutorAuditService,
    private readonly cancellationPollMs: () => number,
    private readonly logger: CancellationTokenLogger,
  ) {}

  async run(
    input: ServerExecutionInput,
    job: ServerExecutorJobRunnerRecord,
  ): Promise<ServerExecutionResult> {
    let lease: ServerExecutorRuntimeLease | undefined;
    let leaseLock: ServerExecutorRuntimeLeaseLock | undefined;
    const cancellationToken = this.createCancellationToken(job.id);
    this.runningCancellationService.register(job.id, cancellationToken);
    const stopHeartbeat = await this.executionRuntimeService.startJobHeartbeat(
      job.id,
    );
    const runtimeObserver =
      this.remoteExecutionMetadataService.createRuntimeObserver(job.id);

    try {
      const trackedInput: ServerExecutionInput = {
        ...input,
        metadata: {
          ...(input.metadata || {}),
          serverExecutionJobId: job.id,
          retryAttempt: job.attempt,
          maxAttempts: job.maxAttempts,
        },
        cancellationToken,
        runtimeObserver,
      };
      const trackedCancellation =
        await this.jobCompletionService.finishCancelledIfRequested(
          trackedInput,
          job.id,
          cancellationToken,
        );
      if (trackedCancellation) return trackedCancellation;

      const policy = await this.commandPolicy.evaluate(trackedInput);
      if (policy.status === "blocked") {
        const result = buildServerExecutorPolicyBlockedResult(
          trackedInput,
          policy,
        );
        return this.jobCompletionService.finishAfterExecution(
          trackedInput,
          job.id,
          result,
        );
      }

      const guardedInput: ServerExecutionInput = {
        ...trackedInput,
        metadata: {
          ...(trackedInput.metadata || {}),
          commandPolicy: policy,
        },
      };
      const adapter = this.executionRuntimeService.resolveAdapter(guardedInput);
      const guardedCancellation =
        await this.jobCompletionService.finishCancelledIfRequested(
          guardedInput,
          job.id,
          cancellationToken,
        );
      if (guardedCancellation) return guardedCancellation;

      const leaseAttempt =
        await this.executionRuntimeService.acquireLiveLease(guardedInput);
      if (leaseAttempt.blocked) {
        return this.jobCompletionService.finishAfterExecution(
          guardedInput,
          job.id,
          leaseAttempt.blocked,
        );
      }

      lease = leaseAttempt.lease;
      leaseLock = leaseAttempt.lock;
      const leasedCancellation =
        await this.jobCompletionService.finishCancelledIfRequested(
          guardedInput,
          job.id,
          cancellationToken,
          {
            releaseLease: true,
            lease,
            leaseLock,
          },
        );
      if (leasedCancellation) return leasedCancellation;

      const leasedInput = lease
        ? {
            ...guardedInput,
            metadata: {
              ...(guardedInput.metadata || {}),
              serverExecutionLeaseId: lease.id,
            },
          }
        : guardedInput;
      const result = await adapter.execute(leasedInput);
      await this.executionRuntimeService.releaseLiveLease(
        lease,
        result.status,
        leaseLock,
      );
      await this.jobCompletionService.finishAfterExecution(
        leasedInput,
        job.id,
        result,
      );
      await this.auditService.writeServerAgentDispatchAudit(
        leasedInput,
        job.id,
        result,
      );
      return result;
    } catch (error) {
      await this.executionRuntimeService.releaseLiveLease(
        lease,
        "failed",
        leaseLock,
      );
      await this.jobLifecycleWriteService.failJob(job.id, error);
      await this.linkedBusinessRunSyncService.syncAfterFailure(
        input,
        job.id,
        error,
      );
      throw error;
    } finally {
      stopHeartbeat();
      cancellationToken.stop();
      this.runningCancellationService.unregister(job.id);
    }
  }

  private createCancellationToken(jobId: string) {
    return this.cancellationTokenService.createToken({
      jobId,
      pollMs: this.cancellationPollMs(),
      logger: this.logger,
    });
  }
}
