import { PrismaService } from "../prisma/prisma.service";
import {
  buildServerExecutorFailureLogs,
  buildServerExecutorFailureResult,
  readServerExecutorFailureMessage,
} from "./server-executor-failure-result.utils";
import { readOptionalString } from "./server-executor-json.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

export class ServerExecutorServiceOperationRunSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const operationRunId = this.readOperationRunId(metadata);
    if (!operationRunId) {
      return false;
    }

    const updated = await this.prisma.applicationServiceOperationRun.updateMany(
      {
        where: { id: operationRunId, teamId: input.teamId },
        data: {
          serverExecutionJobId: jobId,
          status: result.status,
          commandPlan: result.commandPlan,
          logs: result.logs,
          result: result.result,
          error: result.error ?? null,
          finishedAt: new Date(),
        },
      },
    );

    return updated.count > 0;
  }

  async syncAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const operationRunId = this.readOperationRunId(metadata);
    if (!operationRunId) {
      return false;
    }

    const message = readServerExecutorFailureMessage(error);
    const updated = await this.prisma.applicationServiceOperationRun.updateMany(
      {
        where: { id: operationRunId, teamId: input.teamId },
        data: {
          serverExecutionJobId: jobId,
          status: "failed",
          logs: buildServerExecutorFailureLogs(message),
          result: buildServerExecutorFailureResult(input, jobId),
          error: message,
          finishedAt: new Date(),
        },
      },
    );

    return updated.count > 0;
  }

  private readOperationRunId(metadata: Record<string, unknown>) {
    return (
      readOptionalString(metadata.applicationServiceOperationRunId) ||
      readOptionalString(metadata.operationRunId)
    );
  }
}
