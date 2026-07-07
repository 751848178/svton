import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
import { ResourceControlService } from './resource-control.service';
import {
  disabledDockerMetricsSummary,
  disabledDockerSyncSummary,
  emptyScheduledSyncSummary,
  intervalSeconds,
  metricResourceBatchSize,
  metricsMaxAttempts,
  metricsMinIntervalMs,
  scheduledDockerMetricsEnabled,
  scheduledDockerSyncEnabled,
  serverBatchSize,
  staleAfterMs,
  type ScheduledSyncSummary,
} from './resource-control-scheduler-config.utils';

@Injectable()
export class ResourceControlSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(ResourceControlSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceControlService: ResourceControlService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'resource-control';
  }

  isEnabled(): boolean {
    return this.configService.get('RESOURCE_CONTROL_SCHEDULER_ENABLED', 'false') === 'true';
  }

  intervalMs(): number {
    return intervalSeconds(this.configService.get('RESOURCE_CONTROL_SCHEDULER_INTERVAL_SECONDS', '300')) * 1000;
  }

  async runOnce(now = new Date()): Promise<ScheduledSyncSummary> {
    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true);
    }
    try {
      const stale = await this.markStaleResources(now);
      const dockerSync = await this.runScheduledDockerSync();
      const dockerMetrics = await this.runScheduledDockerMetrics(now);
      return { skipped: false, staleMarked: stale.marked, dockerSync, dockerMetrics };
    } finally {
      this.releaseRunLock();
    }
  }

  async markStaleResources(now = new Date()) {
    const staleAfter = staleAfterMs(this.configService.get('RESOURCE_CONTROL_STALE_AFTER_SECONDS', '86400'));
    if (staleAfter <= 0) return { marked: 0, cutoff: null };
    const cutoff = new Date(now.getTime() - staleAfter);
    const result = await this.prisma.managedResource.updateMany({
      where: {
        sourceType: { in: ['server', 'cloud'] },
        status: { notIn: ['stale', 'error'] },
        OR: [{ lastSyncAt: { lt: cutoff } }, { lastSyncAt: null, createdAt: { lt: cutoff } }],
      },
      data: {
        status: 'stale',
        syncError: `Resource marked stale by scheduler; last successful sync is older than ${cutoff.toISOString()}`,
      },
    });
    return { marked: result.count, cutoff };
  }

  async runScheduledDockerSync() {
    if (!scheduledDockerSyncEnabled(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_SYNC_ENABLED', 'true'))) {
      return disabledDockerSyncSummary();
    }
    const servers = await this.prisma.server.findMany({
      where: { status: { not: 'offline' } },
      orderBy: { updatedAt: 'asc' },
      take: serverBatchSize(this.configService.get('RESOURCE_CONTROL_SCHEDULE_SERVER_BATCH_SIZE', '10')),
      select: { id: true, teamId: true },
    });
    const summary = { enabled: true, attempted: 0, completed: 0, failed: 0 };
    for (const server of servers) {
      summary.attempted += 1;
      try {
        const environmentId = await this.primaryEnvironmentId(server.teamId, server.id);
        await this.resourceControlService.syncServerDocker(server.teamId, null, server.id, {
          scope: 'scheduled-docker', includeContainers: true, includeMiddleware: true, environmentId,
        });
        summary.completed += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`Scheduled Docker sync failed for server ${server.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return summary;
  }

  async runScheduledDockerMetrics(now = new Date()) {
    if (!scheduledDockerMetricsEnabled(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED', 'false'))) {
      return disabledDockerMetricsSummary();
    }
    const resources = await this.prisma.managedResource.findMany({
      where: { sourceType: 'server', provider: 'docker', kind: 'docker_container', serverId: { not: null }, status: { notIn: ['stale', 'error'] } },
      orderBy: { updatedAt: 'asc' },
      take: metricResourceBatchSize(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_BATCH_SIZE', '20')),
      select: { id: true, teamId: true },
    });
    const recentSnapshotByResourceId = await this.recentMetricSnapshotMap(resources.map((r) => r.id));
    const minInterval = metricsMinIntervalMs(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MIN_INTERVAL_SECONDS', '300'));
    const summary = { enabled: true, attempted: 0, submitted: 0, skippedRecent: 0, failed: 0 };
    for (const resource of resources) {
      const recentSnapshot = recentSnapshotByResourceId.get(resource.id);
      if (recentSnapshot && now.getTime() - recentSnapshot.getTime() < minInterval) {
        summary.skippedRecent += 1;
        continue;
      }
      summary.attempted += 1;
      try {
        await this.resourceControlService.executeResourceAction(resource.teamId, null, resource.id, {
          action: 'docker.container.stats',
          dryRun: false,
          queue: true,
          maxAttempts: metricsMaxAttempts(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MAX_ATTEMPTS', '1')),
        });
        summary.submitted += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`Scheduled Docker metrics collection failed for resource ${resource.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return summary;
  }

  private async recentMetricSnapshotMap(resourceIds: string[]) {
    if (resourceIds.length === 0) return new Map<string, Date>();
    const snapshots = await this.prisma.resourceMetricSnapshot.findMany({
      where: { resourceId: { in: resourceIds }, metricSource: 'docker_stats' },
      orderBy: { sampledAt: 'desc' },
      select: { resourceId: true, sampledAt: true },
    });
    const recent = new Map<string, Date>();
    for (const snapshot of snapshots) {
      if (!recent.has(snapshot.resourceId)) recent.set(snapshot.resourceId, snapshot.sampledAt);
    }
    return recent;
  }

  private async primaryEnvironmentId(teamId: string, serverId: string) {
    const binding = await this.prisma.projectEnvironmentServer.findFirst({
      where: { teamId, serverId, status: 'active', environment: { status: 'active' } },
      orderBy: { updatedAt: 'desc' },
      select: { environmentId: true },
    });
    return binding?.environmentId;
  }

  private emptySummary(skipped: boolean): ScheduledSyncSummary {
    return emptyScheduledSyncSummary(
      skipped,
      scheduledDockerSyncEnabled(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_SYNC_ENABLED', 'true')),
      scheduledDockerMetricsEnabled(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED', 'false')),
    );
  }
}
