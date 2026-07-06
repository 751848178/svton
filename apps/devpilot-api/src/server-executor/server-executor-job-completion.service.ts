import type { MutableServerExecutionCancellationToken } from "./server-executor-cancellation-token.service";
import type {
  ServerExecutorRuntimeLease,
  ServerExecutorRuntimeLeaseLock,
} from "./server-executor-execution-runtime.service";
import { ServerExecutorExecutionRuntimeService } from "./server-executor-execution-runtime.service";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import { ServerExecutorLinkedBusinessRunSyncService } from "./server-executor-linked-business-run-sync.service";
import { buildServerExecutorCancelledResult } from "./server-executor-result.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

type FinishCancelledOptions = {
  releaseLease?: boolean;
  lease?: ServerExecutorRuntimeLease;
  leaseLock?: ServerExecutorRuntimeLeaseLock;
};

export class ServerExecutorJobCompletionService {
  constructor(
    private readonly executionRuntimeService: ServerExecutorExecutionRuntimeService,
    private readonly jobLifecycleWriteService: ServerExecutorJobLifecycleWriteService,
    private readonly linkedBusinessRunSyncService: ServerExecutorLinkedBusinessRunSyncService,
  ) {}

  async finishAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
  ) {
    await this.jobLifecycleWriteService.finishJob(jobId, result.status, result);
    await this.linkedBusinessRunSyncService.syncAfterExecution(
      input,
      jobId,
      result,
    );
    return result;
  }

  async finishCancelledIfRequested(
    input: ServerExecutionInput,
    jobId: string,
    cancellationToken: MutableServerExecutionCancellationToken,
    options: FinishCancelledOptions = {},
  ) {
    await cancellationToken.checkPersistedCancellation();
    if (!cancellationToken.isCancellationRequested()) {
      return undefined;
    }

    const result = buildServerExecutorCancelledResult(input);
    if (options.releaseLease) {
      await this.executionRuntimeService.releaseLiveLease(
        options.lease,
        result.status,
        options.leaseLock,
      );
    }
    return this.finishAfterExecution(input, jobId, result);
  }
}
