import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { BaseIntervalScheduler } from "../common/scheduler/base-interval-scheduler";
import { LogCenterService } from "./log-center.service";
import {
  buildSlsBackfillParams,
  readSlsBackfillConfig,
} from "./log-sls-backfill-policy.utils";
import {
  readSlsBackfillDefaultIntervalMinutes,
  readSlsBackfillSchedulerDryRun,
  readSlsBackfillSchedulerEnabled,
  readSlsBackfillSchedulerIntervalMs,
  readSlsBackfillSchedulerScanLimit,
} from "./log-sls-backfill-scheduler-config.utils";
import { buildEmptySlsBackfillSummary } from "./log-sls-backfill-scheduler-summary.utils";
import { ScheduledSlsBackfillSummary } from "./log-sls-backfill-scheduler.types";

@Injectable()
export class LogSlsBackfillSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(LogSlsBackfillSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logCenterService: LogCenterService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return "log-sls-backfill";
  }

  isEnabled(): boolean {
    return readSlsBackfillSchedulerEnabled(this.configService);
  }

  intervalMs(): number {
    return readSlsBackfillSchedulerIntervalMs(this.configService);
  }

  async runOnce(): Promise<ScheduledSlsBackfillSummary> {
    if (!this.isEnabled()) {
      return this.emptySummary(false, false);
    }

    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, true);
    }

    try {
      const dryRun = readSlsBackfillSchedulerDryRun(this.configService);
      const streams = await this.prisma.logStream.findMany({
        where: {
          status: "active",
          sourceType: "sls",
        },
        orderBy: [{ lastEntryAt: "asc" }, { updatedAt: "asc" }],
        take: readSlsBackfillSchedulerScanLimit(this.configService),
        select: {
          id: true,
          teamId: true,
          sourceKey: true,
          metadata: true,
        },
      });
      const summary: ScheduledSlsBackfillSummary = {
        skipped: false,
        enabled: true,
        dryRun,
        scanned: streams.length,
        attempted: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
        skippedStreams: 0,
        ingestedEntryCount: 0,
      };

      for (const stream of streams) {
        const backfillConfig = readSlsBackfillConfig(
          stream.metadata,
          readSlsBackfillDefaultIntervalMinutes(this.configService),
        );
        if (!backfillConfig.enabled) {
          summary.skippedStreams += 1;
          continue;
        }

        if (
          await this.hasRecentBackfillRun(
            stream.teamId,
            stream.id,
            backfillConfig.intervalMinutes,
          )
        ) {
          summary.skippedStreams += 1;
          continue;
        }

        const runDryRun = dryRun || !backfillConfig.live;
        if (!runDryRun && !backfillConfig.confirmLiveRead) {
          summary.blocked += 1;
          this.logger.warn(
            `SLS backfill live read for stream ${stream.id} is missing confirmLiveRead`,
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
              tail: backfillConfig.limit,
              params: buildSlsBackfillParams(
                backfillConfig,
                stream.sourceKey || undefined,
                !runDryRun && backfillConfig.confirmLiveRead,
              ),
            },
          );

          if (run.status === "completed") {
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
            `Scheduled SLS backfill failed for stream ${stream.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return summary;
    } finally {
      this.releaseRunLock();
    }
  }

  private async hasRecentBackfillRun(
    teamId: string,
    streamId: string,
    intervalMinutes: number,
  ) {
    const cutoff = new Date(Date.now() - intervalMinutes * 60 * 1000);
    const recentRun = await this.prisma.logCollectionRun.findFirst({
      where: {
        teamId,
        streamId,
        sourceType: "sls",
        startedAt: { gte: cutoff },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    return Boolean(recentRun);
  }

  private emptySummary(skipped: boolean, enabled: boolean) {
    return buildEmptySlsBackfillSummary(
      skipped,
      enabled,
      readSlsBackfillSchedulerDryRun(this.configService),
    );
  }
}
