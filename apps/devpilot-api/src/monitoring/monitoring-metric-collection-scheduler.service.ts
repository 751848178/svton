import { Injectable, Logger, Optional } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceControlService } from '../resource-control/resource-control.service';
import { MonitoringSchedulerConfigService } from './monitoring-scheduler-config.service';
import type { ScheduledMetricCollectionSummary } from './monitoring-scheduler.types';

/**
 * 周期性自动采集受管资源的 docker.stats 指标。
 *
 * 监控告警依赖 ResourceMetricSnapshot，但历史上快照只在用户手动触发
 * `docker.container.stats` 时才写入，导致监控默认无数据。本调度器按可配置
 * 周期遍历运行中的 docker server 资源，复用既有采集链路（executeResourceAction
 * → docker.container.stats → persistDockerMetricSnapshotsFromActionRun）写入快照，
 * 使监控默认拥有数据，无需任何手动操作。
 *
 * 采集本身是 best-effort：单个资源失败只记日志并继续，不中断其余资源。
 */
@Injectable()
export class MonitoringMetricCollectionSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(
    MonitoringMetricCollectionSchedulerService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceControlService: ResourceControlService,
    private readonly schedulerConfig: MonitoringSchedulerConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'monitoring-metric-collection';
  }

  isEnabled(): boolean {
    return this.schedulerConfig.metricAutoCollectEnabled();
  }

  intervalMs(): number {
    return this.schedulerConfig.metricAutoCollectIntervalMs();
  }

  async runOnce(
    _now = new Date(),
  ): Promise<ScheduledMetricCollectionSummary> {
    if (!this.tryAcquireRunLock()) {
      return this.summary(true);
    }
    try {
      const summary = this.summary(false);
      const resources = await this.prisma.managedResource.findMany({
        where: {
          provider: 'docker',
          sourceType: 'server',
          status: { in: ['running', 'active'] },
        },
        orderBy: { updatedAt: 'asc' },
        take: this.schedulerConfig.metricAutoCollectBatchSize(),
        select: { id: true, teamId: true, name: true },
      });
      summary.scanned = resources.length;

      for (const resource of resources) {
        summary.attempted += 1;
        try {
          await this.collectResourceMetrics(resource.teamId, resource.id);
          summary.completed += 1;
        } catch (error) {
          summary.failed += 1;
          this.logger.warn(
            `Scheduled docker.stats collection failed for resource ${resource.id} (${resource.name}): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      return summary;
    } finally {
      this.releaseRunLock();
    }
  }

  /**
   * 复用既有 docker.container.stats 采集链路：
   * executeResourceAction → executor → persistDockerMetricSnapshotsFromActionRun。
   */
  private async collectResourceMetrics(teamId: string, resourceId: string) {
    await this.resourceControlService.executeResourceAction(
      teamId,
      null,
      resourceId,
      {
        action: 'docker.container.stats',
        dryRun: false,
      },
    );
  }

  private summary(skipped: boolean): ScheduledMetricCollectionSummary {
    return {
      skipped,
      enabled: true,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
    };
  }
}
