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

export class ServerExecutorDeploymentRunSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const deploymentRunId = readOptionalString(metadata.deploymentRunId);
    if (!deploymentRunId) {
      return false;
    }

    const updated = await this.prisma.deploymentRun.updateMany({
      where: { id: deploymentRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error,
        finishedAt: new Date(),
      },
    });

    return updated.count > 0;
  }

  async syncAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const deploymentRunId = readOptionalString(metadata.deploymentRunId);
    if (!deploymentRunId) {
      return false;
    }

    const message = readServerExecutorFailureMessage(error);
    const updated = await this.prisma.deploymentRun.updateMany({
      where: { id: deploymentRunId, teamId: input.teamId },
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
