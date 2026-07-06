import { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
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

export class ServerExecutorLogCollectionRunSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logCollectionIngestionService: LogCollectionIngestionService,
  ) {}

  async syncAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const logCollectionRunId = readOptionalString(metadata.logCollectionRunId);
    if (!logCollectionRunId) {
      return false;
    }

    const updated = await this.prisma.logCollectionRun.updateMany({
      where: { id: logCollectionRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        executorKey: result.executorKey,
        adapterKey: result.adapterKey,
        status: result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error ?? null,
        finishedAt: new Date(),
      },
    });

    if (result.status === "completed") {
      await this.logCollectionIngestionService.ingestCompletedRun(
        input.teamId,
        logCollectionRunId,
      );
    }

    return updated.count > 0;
  }

  async syncAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const logCollectionRunId = readOptionalString(metadata.logCollectionRunId);
    if (!logCollectionRunId) {
      return false;
    }

    const message = readServerExecutorFailureMessage(error);
    const updated = await this.prisma.logCollectionRun.updateMany({
      where: { id: logCollectionRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: "failed",
        logs: buildServerExecutorFailureLogs(message),
        result: buildServerExecutorFailureResult(input, jobId),
        error: message,
        finishedAt: new Date(),
      },
    });

    return updated.count > 0;
  }
}
