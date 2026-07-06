import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  AppendLogEntriesDto,
  ListLogEntriesQueryDto,
  ListLogStatsQueryDto,
} from "./dto/log-center.dto";

export type NormalizedLogEntry = {
  level: string;
  message: string;
  timestamp?: Date;
  source?: string;
  labels?: Record<string, unknown>;
  context?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export function normalizeLogEntries(
  dto: AppendLogEntriesDto,
): NormalizedLogEntry[] {
  if (dto.entries && dto.entries.length > 0) {
    return dto.entries.map((entry) => ({
      level: entry.level || "info",
      message: requireLogMessage(entry.message),
      timestamp: entry.timestamp ? new Date(entry.timestamp) : undefined,
      source: entry.source,
      labels: entry.labels,
      context: entry.context,
      raw: entry.raw,
    }));
  }

  if (!dto.message) {
    return [];
  }

  return [
    {
      level: dto.level || "info",
      message: requireLogMessage(dto.message),
      source: dto.source,
      labels: dto.labels,
      context: dto.context,
      raw: dto.raw,
    },
  ];
}

export function buildLogEntryWhere(
  teamId: string,
  query: ListLogEntriesQueryDto | ListLogStatsQueryDto,
) {
  const where: Prisma.LogEntryWhereInput = { teamId };

  if (query.streamId) where.streamId = query.streamId;
  if ("level" in query && query.level) where.level = query.level;
  if (query.source) where.source = query.source;
  if (query.projectId) where.projectId = query.projectId;
  if (query.environmentId) where.environmentId = query.environmentId;
  if (query.applicationServiceId)
    where.applicationServiceId = query.applicationServiceId;
  if (query.serverId) where.serverId = query.serverId;
  if (query.siteId) where.siteId = query.siteId;
  if (query.managedResourceId)
    where.managedResourceId = query.managedResourceId;
  if ("q" in query && query.q) {
    where.message = { contains: query.q };
  }

  return where;
}

export function normalizeLogStatsWindowMinutes(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 60;
  if (!Number.isFinite(parsed)) return 60;
  return Math.min(Math.max(Math.floor(parsed), 1), 10080);
}

export function emptyLogEntryStats(
  windowMinutes: number,
  from: Date,
  to: Date,
) {
  return {
    windowMinutes,
    from,
    to,
    total: 0,
    byLevel: [],
    countByLevel: {},
    warningCount: 0,
    errorCount: 0,
    fatalCount: 0,
    latestEntry: null,
  };
}

function requireLogMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) throw new BadRequestException("日志消息不能为空");
  return trimmed;
}
