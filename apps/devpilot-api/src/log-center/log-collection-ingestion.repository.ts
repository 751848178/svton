import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  LogCollectionIngestionRun,
  LogIngestionStatus,
  ParsedLogLine,
} from "./log-collection-ingestion.types";
import { LogRedactionPolicy, redactLogValue } from "./log-redaction";

@Injectable()
export class LogCollectionIngestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRun(
    teamId: string,
    runId: string,
  ): Promise<LogCollectionIngestionRun | null> {
    return this.prisma.logCollectionRun.findFirst({
      where: { id: runId, teamId },
      include: { stream: true },
    });
  }

  createEntries(
    run: LogCollectionIngestionRun,
    entries: ParsedLogLine[],
    redactionPolicy: LogRedactionPolicy,
  ) {
    return this.prisma.logEntry.createMany({
      data: entries.map((entry) => ({
        teamId: run.teamId,
        streamId: run.streamId,
        actorId: run.actorId,
        projectId: run.projectId,
        environmentId: run.environmentId,
        applicationId: run.applicationId,
        applicationServiceId: run.applicationServiceId,
        serverId: run.serverId,
        siteId: run.siteId,
        managedResourceId: run.managedResourceId,
        deploymentRunId: run.deploymentRunId,
        backupPlanId: run.backupPlanId,
        backupRunId: run.backupRunId,
        alertEventId: run.alertEventId,
        timestamp: entry.timestamp || run.finishedAt || new Date(),
        level: entry.level,
        message: entry.message,
        source: run.sourceType,
        labels: this.toJsonValue({
          sourceType: run.sourceType,
          sourceKey: run.sourceKey,
          collectionRunId: run.id,
          stream: entry.stream,
        }),
        context: this.toJsonValue({
          executorKey: run.executorKey,
          adapterKey: run.adapterKey,
          serverExecutionJobId: run.serverExecutionJobId,
        }),
        raw: this.toJsonValue(
          redactLogValue(
            {
              lineNumber: entry.lineNumber,
              stream: entry.stream,
              line: entry.message,
            },
            redactionPolicy,
          ),
        ),
      })),
    });
  }

  updateStreamSnapshot(run: LogCollectionIngestionRun, entry: ParsedLogLine) {
    return this.prisma.logStream.update({
      where: { id: run.streamId },
      data: {
        lastEntryAt: entry.timestamp || run.finishedAt || new Date(),
        lastLevel: entry.level,
        lastMessage: entry.message,
      },
    });
  }

  markIngestion(
    runId: string,
    status: LogIngestionStatus,
    count: number,
    error: string | null,
  ) {
    return this.prisma.logCollectionRun.update({
      where: { id: runId },
      data: {
        ingestionStatus: status,
        ingestedEntryCount: count,
        ingestionError: error,
        ingestedAt: new Date(),
      },
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
