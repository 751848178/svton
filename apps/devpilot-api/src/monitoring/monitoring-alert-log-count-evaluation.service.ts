import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MonitoringAlertEvaluationResultService } from "./monitoring-alert-evaluation-result.service";
import type { AlertEvaluationResult } from "./monitoring-alert-evaluation.types";
import {
  asRecord,
  readString,
  readStringArray,
} from "./monitoring-alert-evaluation-value.utils";
import type { AlertRuleRecord } from "./monitoring-alert-rule.types";
import { readPositiveInt } from "./monitoring-number.utils";

@Injectable()
export class MonitoringAlertLogCountEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly result: MonitoringAlertEvaluationResultService,
  ) {}

  async evaluate(rule: AlertRuleRecord): Promise<AlertEvaluationResult> {
    const condition = asRecord(rule.condition);
    const windowMinutes = readPositiveInt(
      condition.windowMinutes,
      60,
      1,
      10080,
    );
    const threshold = readPositiveInt(condition.threshold, 1, 1, 100000);
    const levels = normalizeLogAlertLevels(rule.metric, condition.levels);
    const streamId = readString(condition.streamId);
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60 * 1000);
    const where: Prisma.LogEntryWhereInput = {
      teamId: rule.teamId,
      streamId,
      projectId: rule.projectId ?? undefined,
      environmentId: rule.environmentId ?? undefined,
      applicationId: rule.applicationId ?? undefined,
      applicationServiceId: rule.applicationServiceId ?? undefined,
      serverId: rule.serverId ?? undefined,
      siteId: rule.siteId ?? undefined,
      managedResourceId: rule.managedResourceId ?? undefined,
      backupPlanId: rule.backupPlanId ?? undefined,
      level: { in: levels },
      timestamp: { gte: from, lte: to },
    };

    const [count, groupedLevels, latestEntries] = await Promise.all([
      this.prisma.logEntry.count({ where }),
      this.prisma.logEntry.groupBy({
        by: ["level"],
        where,
        _count: { _all: true },
      }),
      this.prisma.logEntry.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: 5,
        select: {
          id: true,
          streamId: true,
          level: true,
          message: true,
          timestamp: true,
          source: true,
        },
      }),
    ]);
    const value = {
      metric: rule.metric,
      windowMinutes,
      threshold,
      levels,
      streamId: streamId || null,
      from,
      to,
      count,
      byLevel: groupedLevels
        .map((item) => ({ level: item.level, count: item._count._all }))
        .sort(
          (left, right) =>
            right.count - left.count || left.level.localeCompare(right.level),
        ),
      latestEntries: latestEntries.map((entry) => ({
        id: entry.id,
        streamId: entry.streamId,
        level: entry.level,
        source: entry.source,
        timestamp: entry.timestamp,
        message: truncate(entry.message, 240),
      })),
    };

    if (count >= threshold) {
      return this.result.firing(
        rule,
        `最近 ${windowMinutes} 分钟 ${levels.join("/")} 日志 ${count} 条，达到阈值 ${threshold}`,
        value,
      );
    }

    return this.result.ok(
      rule,
      `最近 ${windowMinutes} 分钟 ${levels.join("/")} 日志 ${count} 条，未达到阈值 ${threshold}`,
      value,
    );
  }
}

function normalizeLogAlertLevels(metric: string, value: unknown) {
  const requested = readStringArray(value)
    .map((item) => item.toLowerCase())
    .filter((item) =>
      ["trace", "debug", "info", "warn", "error", "fatal"].includes(item),
    );
  if (requested.length > 0) return [...new Set(requested)];
  if (metric === "log_fatal_count") return ["fatal"];
  if (metric === "log_warning_count") return ["warn", "error", "fatal"];
  return ["error", "fatal"];
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}
