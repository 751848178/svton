import { buildServerExecutorQueuedResult } from "./server-executor-result.utils";
import type { ServerExecutorExecutionCoreServices } from "./server-executor-execution-core-factory.service";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerQueuedExecutionOptions,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

export class ServerExecutorSubmissionService {
  constructor(private readonly core: ServerExecutorExecutionCoreServices) {}

  async execute(input: ServerExecutionInput): Promise<ServerExecutionResult> {
    const job = await this.core.jobLifecycleWriteService.createInlineJob(input);
    return this.core.jobRunnerService.run(input, job);
  }

  async queueExecution(
    input: ServerExecutionInput,
    options: ServerQueuedExecutionOptions = {},
  ): Promise<ServerQueuedExecutionResult> {
    const job = await this.core.jobLifecycleWriteService.enqueueJob(input, {
      maxAttempts: options.maxAttempts,
      availableAt: options.availableAt,
    });

    return buildServerExecutorQueuedResult(input, {
      id: job.id,
      queuedAt: job.queuedAt,
      availableAt: job.availableAt,
    });
  }

  async cancelJob(teamId: string, userId: string, id: string) {
    return this.core.jobCancellationService.cancelJob(teamId, userId, id);
  }
}
