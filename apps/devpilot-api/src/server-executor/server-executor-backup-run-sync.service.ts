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

export class ServerExecutorBackupRunSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const backupRunId = readOptionalString(metadata.backupRunId);
    if (!backupRunId) {
      return false;
    }

    const now = new Date();
    const updated = await this.prisma.backupRun.updateMany({
      where: { id: backupRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error ?? null,
        finishedAt: now,
      },
    });

    if (updated.count === 0) {
      return false;
    }

    await this.syncBackupPlanLastRun(
      input.teamId,
      metadata,
      now,
      result.status,
    );
    return true;
  }

  async syncAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const backupRunId = readOptionalString(metadata.backupRunId);
    if (!backupRunId) {
      return false;
    }

    const now = new Date();
    const message = readServerExecutorFailureMessage(error);
    const updated = await this.prisma.backupRun.updateMany({
      where: { id: backupRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: "failed",
        logs: buildServerExecutorFailureLogs(message),
        result: buildServerExecutorFailureResult(input, jobId),
        error: message,
        finishedAt: now,
      },
    });

    if (updated.count === 0) {
      return false;
    }

    await this.syncBackupPlanLastRun(input.teamId, metadata, now, "failed");
    return true;
  }

  private async syncBackupPlanLastRun(
    teamId: string,
    metadata: Record<string, unknown>,
    ranAt: Date,
    status: string,
  ) {
    const backupPlanId = readOptionalString(metadata.backupPlanId);
    if (!backupPlanId) {
      return;
    }

    await this.prisma.backupPlan.updateMany({
      where: { id: backupPlanId, teamId },
      data: {
        lastRunAt: ranAt,
        lastStatus: status,
      },
    });
  }
}
