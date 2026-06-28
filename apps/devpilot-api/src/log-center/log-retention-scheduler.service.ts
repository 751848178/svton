import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LogCenterService } from './log-center.service';

type ScheduledLogRetentionSummary = {
  skipped: boolean;
  enabled: boolean;
  dryRun: boolean;
  attempted: number;
  completed: number;
  failed: number;
  deletedEntryCount: number;
};

@Injectable()
export class LogRetentionSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LogRetentionSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

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
    this.logger.log(`Log retention scheduler enabled; interval=${intervalMs}ms; dryRun=${this.schedulerDryRun()}`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runOnce(): Promise<ScheduledLogRetentionSummary> {
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
          retentionDays: { gt: 0 },
        },
        orderBy: [{ lastEntryAt: 'asc' }, { updatedAt: 'asc' }],
        take: this.batchSize(),
        select: {
          id: true,
          teamId: true,
        },
      });
      const summary: ScheduledLogRetentionSummary = {
        skipped: false,
        enabled: true,
        dryRun,
        attempted: 0,
        completed: 0,
        failed: 0,
        deletedEntryCount: 0,
      };

      for (const stream of streams) {
        summary.attempted += 1;
        try {
          const run = await this.logCenterService.cleanupRetention(stream.teamId, null, stream.id, { dryRun });
          if (run.status === 'completed') {
            summary.completed += 1;
            summary.deletedEntryCount += run.deletedEntryCount;
          } else {
            summary.failed += 1;
          }
        } catch (error) {
          summary.failed += 1;
          this.logger.warn(
            `Scheduled log retention failed for stream ${stream.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return summary;
    } finally {
      this.running = false;
    }
  }

  private emptySummary(skipped: boolean, enabled: boolean): ScheduledLogRetentionSummary {
    return {
      skipped,
      enabled,
      dryRun: this.schedulerDryRun(),
      attempted: 0,
      completed: 0,
      failed: 0,
      deletedEntryCount: 0,
    };
  }

  private schedulerEnabled() {
    return this.configService.get('LOG_RETENTION_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private schedulerDryRun() {
    return this.configService.get('LOG_RETENTION_SCHEDULER_DRY_RUN', 'true') !== 'false';
  }

  private schedulerIntervalMs() {
    const seconds = Number(this.configService.get('LOG_RETENTION_SCHEDULER_INTERVAL_SECONDS', '3600'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 3600;
    return safeSeconds * 1000;
  }

  private batchSize() {
    const size = Number(this.configService.get('LOG_RETENTION_SCHEDULER_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }
}
