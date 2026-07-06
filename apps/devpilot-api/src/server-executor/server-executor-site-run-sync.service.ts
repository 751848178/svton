import { PrismaService } from "../prisma/prisma.service";
import {
  buildServerExecutorFailureLogs,
  buildServerExecutorFailureResult,
  readServerExecutorFailureMessage,
} from "./server-executor-failure-result.utils";
import { readOptionalString, toJsonValue } from "./server-executor-json.utils";
import { ServerExecutorSiteTlsFollowUpService } from "./server-executor-site-tls-follow-up.service";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

type QueueSiteRunExecution = (
  input: ServerExecutionInput,
  options?: { maxAttempts?: number; availableAt?: Date },
) => Promise<ServerQueuedExecutionResult>;

export class ServerExecutorSiteRunSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteTlsFollowUpService: ServerExecutorSiteTlsFollowUpService,
  ) {}

  async syncAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
    queueExecution: QueueSiteRunExecution,
  ) {
    const siteSyncRunId = readOptionalString(metadata.siteSyncRunId);
    if (!siteSyncRunId) {
      return false;
    }

    const now = new Date();
    const updated = await this.prisma.siteSyncRun.updateMany({
      where: { id: siteSyncRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        executorKey: result.executorKey,
        adapterKey: result.adapterKey,
        commandPlan: toJsonValue(result.commandSteps),
        executionPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        warnings: toJsonValue(result.warnings),
        error: result.error ?? null,
        finishedAt: now,
      },
    });

    if (updated.count === 0) {
      return false;
    }

    await this.syncSiteStateAfterExecution(
      input,
      result,
      metadata,
      now,
      queueExecution,
    );

    return true;
  }

  async syncAfterFailure(
    input: ServerExecutionInput,
    jobId: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ) {
    const siteSyncRunId = readOptionalString(metadata.siteSyncRunId);
    if (!siteSyncRunId) {
      return false;
    }

    const now = new Date();
    const message = readServerExecutorFailureMessage(error);
    const updated = await this.prisma.siteSyncRun.updateMany({
      where: { id: siteSyncRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: "failed",
        logs: buildServerExecutorFailureLogs(message),
        result: buildServerExecutorFailureResult(input, jobId),
        error: message,
        finishedAt: now,
      },
    });

    if (updated.count === 0 || input.dryRun) {
      return updated.count > 0;
    }

    const siteId = readOptionalString(metadata.siteId);
    const mode = readOptionalString(metadata.mode);
    if (siteId && (mode === "sync" || mode === "rollback")) {
      await this.prisma.site.updateMany({
        where: { id: siteId, teamId: input.teamId },
        data: {
          status: "error",
          lastSyncAt: now,
          syncError: message,
        },
      });
    }

    return true;
  }

  private async syncSiteStateAfterExecution(
    input: ServerExecutionInput,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
    now: Date,
    queueExecution: QueueSiteRunExecution,
  ) {
    const siteId = readOptionalString(metadata.siteId);
    if (!siteId) {
      return;
    }

    const mode = readOptionalString(metadata.mode);
    if (!input.dryRun) {
      if (mode === "sync" || mode === "rollback") {
        await this.prisma.site.updateMany({
          where: { id: siteId, teamId: input.teamId },
          data: {
            status: result.status === "completed" ? "active" : "error",
            lastSyncAt: now,
            syncError:
              result.status === "completed"
                ? null
                : result.error || "站点同步执行未完成",
          },
        });
      }
      if (mode === "tls_probe" && result.status === "completed") {
        await this.siteTlsFollowUpService.refreshAfterProbe(
          input.teamId,
          siteId,
          result,
          metadata,
        );
      }
    }

    if (
      mode === "tls_renew" &&
      (result.status === "completed" || result.status === "failed")
    ) {
      const renewal = await this.siteTlsFollowUpService.refreshAfterRenew(
        input.teamId,
        siteId,
        input.dryRun,
        result,
        metadata,
      );
      if (
        !input.dryRun &&
        result.status === "completed" &&
        renewal?.succeeded
      ) {
        await this.siteTlsFollowUpService.queueProbeAfterRenewal(
          input,
          siteId,
          metadata,
          queueExecution,
        );
      }
    }
  }
}
