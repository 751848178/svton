import { PrismaService } from "../prisma/prisma.service";
import { buildDockerStatsMetricSnapshotInputs } from "../resource-control/metrics/docker-stats-metrics";
import {
  buildServerExecutorFailureResult,
  readServerExecutorFailureMessage,
} from "./server-executor-failure-result.utils";
import { readOptionalString } from "./server-executor-json.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

export class ServerExecutorResourceActionRunSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncAfterExecution(
    input: ServerExecutionInput,
    jobId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const resourceActionRunId = readOptionalString(
      metadata.resourceActionRunId,
    );
    if (!resourceActionRunId) {
      return false;
    }

    const updated = await this.prisma.resourceActionRun.updateMany({
      where: { id: resourceActionRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: result.status,
        commandPlan: result.commandPlan,
        result: result.result,
        error: result.error ?? null,
        finishedAt: new Date(),
      },
    });

    if (updated.count > 0) {
      await this.persistDockerMetricSnapshotsFromActionRun(
        input.teamId,
        resourceActionRunId,
        result.result,
        result.logs,
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
    const resourceActionRunId = readOptionalString(
      metadata.resourceActionRunId,
    );
    if (!resourceActionRunId) {
      return false;
    }

    const message = readServerExecutorFailureMessage(error);
    const updated = await this.prisma.resourceActionRun.updateMany({
      where: { id: resourceActionRunId, teamId: input.teamId },
      data: {
        serverExecutionJobId: jobId,
        status: "failed",
        result: buildServerExecutorFailureResult(input, jobId),
        error: message,
        finishedAt: new Date(),
      },
    });

    return updated.count > 0;
  }

  async persistDockerMetricSnapshotsFromActionRun(
    teamId: string,
    resourceActionRunId: string,
    result: unknown,
    logs?: unknown,
  ) {
    const actionRun = await this.prisma.resourceActionRun.findFirst({
      where: { id: resourceActionRunId, teamId },
      select: {
        id: true,
        teamId: true,
        resourceId: true,
        action: true,
        dryRun: true,
        status: true,
        resource: {
          select: {
            id: true,
            sourceType: true,
            provider: true,
            kind: true,
            serverId: true,
            projectId: true,
            environmentId: true,
          },
        },
      },
    });

    if (
      !actionRun ||
      actionRun.action !== "docker.container.stats" ||
      actionRun.dryRun ||
      actionRun.status !== "completed"
    ) {
      return 0;
    }

    const existingCount = await this.prisma.resourceMetricSnapshot.count({
      where: { teamId, resourceActionRunId },
    });
    if (existingCount > 0) {
      return 0;
    }

    const snapshots = buildDockerStatsMetricSnapshotInputs(
      {
        teamId: actionRun.teamId,
        resourceId: actionRun.resourceId,
        resourceActionRunId: actionRun.id,
        serverId: actionRun.resource.serverId,
        projectId: actionRun.resource.projectId,
        environmentId: actionRun.resource.environmentId,
        sourceType: actionRun.resource.sourceType,
        provider: actionRun.resource.provider,
        kind: actionRun.resource.kind,
      },
      result,
      logs,
    );

    if (snapshots.length === 0) {
      return 0;
    }

    const created = await this.prisma.resourceMetricSnapshot.createMany({
      data: snapshots,
    });
    return created.count;
  }
}
