import { PrismaService } from "../prisma/prisma.service";
import {
  failDeploymentInitializationCheckpoint,
  finishDeploymentInitializationCheckpoint,
} from "../deployment/deployment-initialization-checkpoint.repository";
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

    const initializationError = await finishDeploymentInitializationCheckpoint(
      this.prisma,
      readOptionalString(metadata.initializationCheckpointId),
      result,
    );
    const updated = await this.prisma.deploymentRun.updateMany({
      where: { id: deploymentRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status:
          initializationError && result.status === "completed"
            ? "failed"
            : result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: initializationError || result.error,
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
    await failDeploymentInitializationCheckpoint(
      this.prisma,
      readOptionalString(metadata.initializationCheckpointId),
      message,
    );
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
