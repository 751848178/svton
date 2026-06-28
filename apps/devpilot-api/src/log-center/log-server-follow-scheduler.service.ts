import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LogCenterService } from './log-center.service';

type ScheduledServerFollowSummary = {
  skipped: boolean;
  enabled: boolean;
  dryRun: boolean;
  scanned: number;
  attempted: number;
  queued: number;
  completed: number;
  failed: number;
  blocked: number;
  skippedStreams: number;
  ingestedEntryCount: number;
};

type ServerFollowConfig = {
  enabled: boolean;
  live: boolean;
  confirmLiveRead: boolean;
  queue: boolean;
  tail: number;
  intervalMinutes: number;
  maxAttempts: number;
};

@Injectable()
export class LogServerFollowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LogServerFollowSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly sourceTypes = ['docker', 'nginx', 'server_executor'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly logCenterService: LogCenterService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.schedulerEnabled()) {
      return;
    }

    const intervalMs = this.schedulerIntervalMs();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.logger.log(`Server log follow scheduler enabled; interval=${intervalMs}ms; dryRun=${this.schedulerDryRun()}`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runOnce(): Promise<ScheduledServerFollowSummary> {
    if (!this.schedulerEnabled()) {
      return this.emptySummary(false, false);
    }

    if (this.running) {
      return this.emptySummary(true, true);
    }

    this.running = true;
    try {
      const dryRun = this.schedulerDryRun();
      const streams = await this.prisma.logStream.findMany({
        where: {
          status: 'active',
          sourceType: { in: this.sourceTypes },
        },
        orderBy: [{ lastEntryAt: 'asc' }, { updatedAt: 'asc' }],
        take: this.scanLimit(),
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
        const followConfig = this.readFollowConfig(stream.metadata);
        if (!followConfig.enabled) {
          summary.skippedStreams += 1;
          continue;
        }

        if (await this.hasRecentFollowRun(stream.teamId, stream.id, followConfig.intervalMinutes)) {
          summary.skippedStreams += 1;
          continue;
        }

        const runDryRun = dryRun || !followConfig.live;
        if (!runDryRun && !followConfig.confirmLiveRead) {
          summary.blocked += 1;
          this.logger.warn(`Server log follow live read for stream ${stream.id} is missing confirmLiveRead`);
          continue;
        }

        summary.attempted += 1;
        try {
          const run = await this.logCenterService.collectStream(stream.teamId, null, stream.id, {
            dryRun: runDryRun,
            queue: !runDryRun && followConfig.queue,
            tail: followConfig.tail,
            maxAttempts: followConfig.maxAttempts,
            params: {
              scheduledServerFollow: true,
              sourceType: stream.sourceType,
              confirmLiveRead: !runDryRun && followConfig.confirmLiveRead,
            },
          });

          if (run.status === 'queued') {
            summary.queued += 1;
          } else if (run.status === 'completed') {
            summary.completed += 1;
            summary.ingestedEntryCount += run.ingestedEntryCount || 0;
          } else if (run.status === 'blocked') {
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
      this.running = false;
    }
  }

  private async hasRecentFollowRun(teamId: string, streamId: string, intervalMinutes: number) {
    const cutoff = new Date(Date.now() - intervalMinutes * 60 * 1000);
    const recentRun = await this.prisma.logCollectionRun.findFirst({
      where: {
        teamId,
        streamId,
        sourceType: { in: this.sourceTypes },
        startedAt: { gte: cutoff },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    return Boolean(recentRun);
  }

  private readFollowConfig(metadata: Prisma.JsonValue | null | undefined): ServerFollowConfig {
    const record = this.asRecord(metadata);
    const raw = this.hasRecord(record.serverFollow)
      ? this.asRecord(record.serverFollow)
      : this.asRecord(record.serverCollection);
    return {
      enabled: raw.enabled === true,
      live: raw.live === true,
      confirmLiveRead: raw.confirmLiveRead === true,
      queue: raw.queue !== false,
      tail: this.asPositiveInt(raw.tail, 200, 5000),
      intervalMinutes: this.asPositiveInt(
        raw.intervalMinutes,
        this.defaultIntervalMinutes(),
        10080,
      ),
      maxAttempts: this.asPositiveInt(raw.maxAttempts, 3, 10),
    };
  }

  private emptySummary(skipped: boolean, enabled: boolean): ScheduledServerFollowSummary {
    return {
      skipped,
      enabled,
      dryRun: this.schedulerDryRun(),
      scanned: 0,
      attempted: 0,
      queued: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skippedStreams: 0,
      ingestedEntryCount: 0,
    };
  }

  private schedulerEnabled() {
    return this.configService.get('LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private schedulerDryRun() {
    return this.configService.get('LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN', 'true') !== 'false';
  }

  private schedulerIntervalMs() {
    const seconds = Number(this.configService.get('LOG_CENTER_SERVER_FOLLOW_SCHEDULER_INTERVAL_SECONDS', '300'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 300;
    return safeSeconds * 1000;
  }

  private scanLimit() {
    const size = Number(this.configService.get('LOG_CENTER_SERVER_FOLLOW_SCHEDULER_SCAN_LIMIT', '100'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 500) : 100;
  }

  private defaultIntervalMinutes() {
    const minutes = Number(this.configService.get('LOG_CENTER_SERVER_FOLLOW_DEFAULT_INTERVAL_MINUTES', '5'));
    return Number.isFinite(minutes) && minutes > 0 ? Math.min(Math.floor(minutes), 10080) : 5;
  }

  private asPositiveInt(value: unknown, fallback: number, max: number) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : fallback;
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(Math.floor(parsed), max);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private hasRecord(value: unknown) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
