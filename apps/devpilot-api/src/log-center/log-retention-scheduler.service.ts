import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
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
export class LogRetentionSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(LogRetentionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logCenterService: LogCenterService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'log-retention';
  }

  isEnabled(): boolean {
    return this.configService.get('LOG_RETENTION_SCHEDULER_ENABLED', 'false') === 'true';
  }

  intervalMs(): number {
    const seconds = Number(this.configService.get('LOG_RETENTION_SCHEDULER_INTERVAL_SECONDS', '3600'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 3600;
    return safeSeconds * 1000;
  }

  async runOnce(): Promise<ScheduledLogRetentionSummary> {
    if (!this.isEnabled()) {
      return this.emptySummary(false, false);
    }
    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, true);
    }
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
      this.releaseRunLock();
    }
  }

  /** 兼容历史：当基类 runOnceSafe 因并发被跳过时，外部观察到的"跳过"语义。 */
  emptySummary(skipped: boolean, enabled: boolean): ScheduledLogRetentionSummary {
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

  private schedulerDryRun() {
    return this.configService.get('LOG_RETENTION_SCHEDULER_DRY_RUN', 'true') !== 'false';
  }

  private batchSize() {
    const size = Number(this.configService.get('LOG_RETENTION_SCHEDULER_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }
}
