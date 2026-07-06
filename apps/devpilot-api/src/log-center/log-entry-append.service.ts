import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AppendLogEntriesDto } from "./dto/log-center.dto";
import { LogCenterAuditService } from "./log-center-audit.service";
import { normalizeLogEntries } from "./log-center-entry-query.utils";
import { logStreamInclude } from "./log-center-includes.constants";
import { toJsonValue } from "./log-center-value.utils";
import {
  redactLogMessage,
  redactLogValue,
  resolveLogRedactionPolicy,
} from "./log-redaction";

const logEntryAppendInclude = Prisma.validator<Prisma.LogEntryInclude>()({
  stream: {
    select: {
      id: true,
      projectId: true,
      environmentId: true,
      name: true,
      sourceType: true,
      status: true,
    },
  },
  actor: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true } },
  environment: { select: { id: true, key: true, name: true, status: true } },
  application: { select: { id: true, name: true, status: true } },
  applicationService: {
    select: { id: true, name: true, kind: true, status: true },
  },
  server: { select: { id: true, name: true, host: true, status: true } },
  site: { select: { id: true, name: true, primaryDomain: true, status: true } },
  managedResource: {
    select: {
      id: true,
      name: true,
      sourceType: true,
      provider: true,
      kind: true,
      status: true,
      endpoint: true,
    },
  },
  deploymentRun: {
    select: { id: true, source: true, trigger: true, status: true },
  },
  backupPlan: {
    select: { id: true, name: true, status: true, lastStatus: true },
  },
  backupRun: {
    select: { id: true, backupType: true, status: true, dryRun: true },
  },
  alertEvent: {
    select: { id: true, metric: true, severity: true, status: true },
  },
});

type LogEntryAppendStream = {
  id: string;
  name: string;
  sourceType: string;
  sourceKey?: string | null;
  metadata?: unknown;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  deploymentRunId?: string | null;
  backupPlanId?: string | null;
  backupRunId?: string | null;
  alertEventId?: string | null;
};

@Injectable()
export class LogEntryAppendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logCenterAuditService: LogCenterAuditService,
  ) {}

  async append(
    teamId: string,
    userId: string,
    stream: LogEntryAppendStream,
    dto: AppendLogEntriesDto,
  ) {
    const normalizedEntries = normalizeLogEntries(dto);
    if (normalizedEntries.length === 0) {
      throw new BadRequestException("至少需要追加一条日志");
    }
    if (normalizedEntries.length > 100) {
      throw new BadRequestException("单次最多追加 100 条日志");
    }

    const createdEntries = [];
    const redactionPolicy = resolveLogRedactionPolicy(stream.metadata);
    for (const entry of normalizedEntries) {
      const message = redactLogMessage(entry.message, redactionPolicy);
      const created = await this.prisma.logEntry.create({
        data: {
          teamId,
          streamId: stream.id,
          actorId: userId,
          projectId: stream.projectId,
          environmentId: stream.environmentId,
          applicationId: stream.applicationId,
          applicationServiceId: stream.applicationServiceId,
          serverId: stream.serverId,
          siteId: stream.siteId,
          managedResourceId: stream.managedResourceId,
          deploymentRunId: stream.deploymentRunId,
          backupPlanId: stream.backupPlanId,
          backupRunId: stream.backupRunId,
          alertEventId: stream.alertEventId,
          timestamp: entry.timestamp || new Date(),
          level: entry.level,
          message,
          source: entry.source || stream.sourceType,
          labels: entry.labels
            ? toJsonValue(redactLogValue(entry.labels, redactionPolicy))
            : undefined,
          context: entry.context
            ? toJsonValue(redactLogValue(entry.context, redactionPolicy))
            : undefined,
          raw: entry.raw
            ? toJsonValue(redactLogValue(entry.raw, redactionPolicy))
            : undefined,
        },
        include: logEntryAppendInclude,
      });
      createdEntries.push(created);
    }

    const lastEntry = createdEntries[createdEntries.length - 1];
    const updatedStream = await this.prisma.logStream.update({
      where: { id: stream.id },
      data: {
        lastEntryAt: lastEntry.timestamp,
        lastLevel: lastEntry.level,
        lastMessage: lastEntry.message,
      },
      include: logStreamInclude,
    });

    await this.logCenterAuditService.recordAppend(
      teamId,
      userId,
      updatedStream,
      lastEntry,
      createdEntries.length,
    );
    return { stream: updatedStream, entries: createdEntries };
  }
}
