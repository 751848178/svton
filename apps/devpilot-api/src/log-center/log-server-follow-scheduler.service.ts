import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { BaseIntervalScheduler } from "../common/scheduler/base-interval-scheduler";
import { LogCenterService } from "./log-center.service";
import {
  buildLogFollowParams,
  LOG_SERVER_FOLLOW_SOURCE_TYPES,
  readLogFollowConfig,
} from "./log-server-follow-policy.utils";
import {
  readServerFollowDefaultIntervalMinutes,
  readServerFollowSchedulerDryRun,
  readServerFollowSchedulerEnabled,
  readServerFollowSchedulerIntervalMs,
  readServerFollowSchedulerScanLimit,
} from "./log-server-follow-scheduler-config.utils";
import { buildEmptyServerFollowSummary } from "./log-server-follow-scheduler-summary.utils";
import { ScheduledServerFollowSummary } from "./log-server-follow-scheduler.types";

@Injectable()
export class LogServerFollowSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(LogServerFollowSchedulerService.name);
  private readonly sourceTypes = LOG_SERVER_FOLLOW_SOURCE_TYPES;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logCenterService: LogCenterService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return "log-server-follow";
  }

  isEnabled(): boolean {
    return readServerFollowSchedulerEnabled(this.configService);
  }

  intervalMs(): number {
    return readServerFollowSchedulerIntervalMs(this.configService);
  }

  async runOnce(): Promise<ScheduledServerFollowSummary> {
    if (!this.isEnabled()) {
      return this.emptySummary(false, false);
    }
    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, true);
    }
    try {
      const dryRun = readServerFollowSchedulerDryRun(this.configService);
      const streams = await this.prisma.logStream.findMany({
        where: {
          status: "active",
          sourceType: { in: this.sourceTypes },
        },
        orderBy: [{ lastEntryAt: "asc" }, { updatedAt: "asc" }],
        take: readServerFollowSchedulerScanLimit(this.configService),
        select: {
          id: true,
          teamId: true,
          sourceType: true,
          metadata: true,
        },
      });
      const summary: ScheduledServerFollowSummary = {
        skipped: false,
        enabled: true,
        dryRun,
        scanned: streams.length,
        attempted: 0,
        queued: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
        skippedStreams: 0,
        ingestedEntryCount: 0,
      };

      for (const stream of streams) {
        const followConfig = readLogFollowConfig(
          stream.metadata,
          readServerFollowDefaultIntervalMinutes(this.configService),
        );
        if (!followConfig.enabled) {
          summary.skippedStreams += 1;
          continue;
        }

        if (
          await this.hasRecentFollowRun(
            stream.teamId,
            stream.id,
            followConfig.intervalMinutes,
          )
        ) {
          summary.skippedStreams += 1;
          continue;
        }

        const runDryRun = dryRun || !followConfig.live;
        if (!runDryRun && !followConfig.confirmLiveRead) {
          summary.blocked += 1;
          this.logger.warn(
            `${followConfig.mode} log follow live read for stream ${stream.id} is missing confirmLiveRead`,
          );
          continue;
        }

        summary.attempted += 1;
        try {
          const run = await this.logCenterService.collectStream(
            stream.teamId,
            null,
            stream.id,
            {
              dryRun: runDryRun,
              queue: !runDryRun && followConfig.queue,
              tail: followConfig.tail,
              maxAttempts: followConfig.maxAttempts,
              params: buildLogFollowParams(
                stream.sourceType,
                followConfig,
                !runDryRun && followConfig.confirmLiveRead,
              ),
            },
          );

          if (run.status === "queued") {
            summary.queued += 1;
          } else if (run.status === "completed") {
            summary.completed += 1;
            summary.ingestedEntryCount += run.ingestedEntryCount || 0;
          } else if (run.status === "blocked") {
            summary.blocked += 1;
          } else {
            summary.failed += 1;
          }
        } catch (error) {
          summary.failed += 1;
          this.logger.warn(
            `Scheduled server log follow failed for stream ${stream.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return summary;
    } finally {
      this.releaseRunLock();
    }
  }

  private async hasRecentFollowRun(
    teamId: string,
    streamId: string,
    intervalMinutes: number,
  ) {
    const cutoff = new Date(Date.now() - intervalMinutes * 60 * 1000);
    const recentRun = await this.prisma.logCollectionRun.findFirst({
      where: {
        teamId,
        streamId,
        sourceType: { in: this.sourceTypes },
        startedAt: { gte: cutoff },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    return Boolean(recentRun);
  }

  private emptySummary(skipped: boolean, enabled: boolean) {
    return buildEmptyServerFollowSummary(
      skipped,
      enabled,
      readServerFollowSchedulerDryRun(this.configService),
    );
  }
}
