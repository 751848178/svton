import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  TailLogEntriesQueryDto,
  ListLogEntriesQueryDto,
  ListLogStatsQueryDto,
} from "./dto/log-center.dto";
import {
  buildLogEntryWhere,
  emptyLogEntryStats,
  normalizeLogStatsWindowMinutes,
} from "./log-center-entry-query.utils";
import { logEntryInclude } from "./log-center-includes.constants";
import {
  buildTailCursor,
  normalizeTailEntryLimit,
  parseTailCursor,
} from "./log-center-value.utils";

@Injectable()
export class LogEntryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(teamId: string, query: ListLogEntriesQueryDto) {
    const where = buildLogEntryWhere(teamId, query);

    return this.prisma.logEntry.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 200,
      include: logEntryInclude,
    });
  }

  async tail(teamId: string, streamId: string, query: TailLogEntriesQueryDto) {
    const stream = await this.requireStream(teamId, streamId);
    const limit = normalizeTailEntryLimit(query.limit);
    const cursor = parseTailCursor(query.cursor);
    const where: Prisma.LogEntryWhereInput = {
      teamId,
      streamId: stream.id,
    };

    if (cursor) {
      where.OR = [
        { timestamp: { gt: cursor.timestamp } },
        {
          timestamp: cursor.timestamp,
          createdAt: { gt: cursor.createdAt },
        },
        {
          timestamp: cursor.timestamp,
          createdAt: cursor.createdAt,
          id: { gt: cursor.id },
        },
      ];
    }

    const entries = await this.prisma.logEntry.findMany({
      where,
      orderBy: cursor
        ? [{ timestamp: "asc" }, { createdAt: "asc" }, { id: "asc" }]
        : [{ timestamp: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: limit,
      include: logEntryInclude,
    });
    const orderedEntries = cursor ? entries : [...entries].reverse();
    const latestEntry = orderedEntries[orderedEntries.length - 1];

    return {
      streamId: stream.id,
      limit,
      pollAfterMs: 3000,
      hasMore: entries.length === limit,
      cursor: latestEntry
        ? buildTailCursor(
            latestEntry.timestamp,
            latestEntry.createdAt,
            latestEntry.id,
          )
        : query.cursor || null,
      entries: orderedEntries,
    };
  }

  async stats(
    teamId: string,
    query: ListLogStatsQueryDto,
    readableStreamIds: string[],
  ) {
    const windowMinutes = normalizeLogStatsWindowMinutes(query.windowMinutes);
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60 * 1000);

    if (readableStreamIds.length === 0) {
      return emptyLogEntryStats(windowMinutes, from, to);
    }

    const where = buildLogEntryWhere(teamId, query);
    where.timestamp = { gte: from, lte: to };
    where.streamId = query.streamId || { in: readableStreamIds };

    const [total, groupedLevels, latestEntry] = await Promise.all([
      this.prisma.logEntry.count({ where }),
      this.prisma.logEntry.groupBy({
        by: ["level"],
        where,
        _count: { _all: true },
      }),
      this.prisma.logEntry.findFirst({
        where,
        orderBy: { timestamp: "desc" },
        select: {
          id: true,
          level: true,
          message: true,
          timestamp: true,
          streamId: true,
        },
      }),
    ]);
    const byLevel = groupedLevels
      .map((item) => ({ level: item.level, count: item._count._all }))
      .sort(
        (left, right) =>
          right.count - left.count || left.level.localeCompare(right.level),
      );
    const countByLevel = Object.fromEntries(
      byLevel.map((item) => [item.level, item.count]),
    );

    return {
      windowMinutes,
      from,
      to,
      total,
      byLevel,
      countByLevel,
      warningCount: countByLevel.warn || 0,
      errorCount: countByLevel.error || 0,
      fatalCount: countByLevel.fatal || 0,
      latestEntry,
    };
  }

  private async requireStream(teamId: string, streamId: string) {
    const stream = await this.prisma.logStream.findFirst({
      where: { id: streamId, teamId },
      select: { id: true },
    });

    if (!stream) {
      throw new NotFoundException("日志流不存在");
    }

    return stream;
  }
}
