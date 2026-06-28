import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceControlService } from './resource-control.service';

type ScheduledSyncSummary = {
  skipped: boolean;
  staleMarked: number;
  dockerSync: {
    enabled: boolean;
    attempted: number;
    completed: number;
    failed: number;
  };
  dockerMetrics: {
    enabled: boolean;
    attempted: number;
    submitted: number;
    skippedRecent: number;
    failed: number;
  };
};

@Injectable()
export class ResourceControlSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResourceControlSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resourceControlService: ResourceControlService,
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
    this.logger.log(`Resource control scheduler enabled; interval=${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runOnce(now = new Date()): Promise<ScheduledSyncSummary> {
    if (this.running) {
      return this.emptySummary(true);
    }

    this.running = true;
    try {
      const stale = await this.markStaleResources(now);
      const dockerSync = await this.runScheduledDockerSync();
      const dockerMetrics = await this.runScheduledDockerMetrics(now);
      return {
        skipped: false,
        staleMarked: stale.marked,
        dockerSync,
        dockerMetrics,
      };
    } finally {
      this.running = false;
    }
  }

  async markStaleResources(now = new Date()) {
    const staleAfterMs = this.staleAfterMs();
    if (staleAfterMs <= 0) {
      return { marked: 0, cutoff: null };
    }

    const cutoff = new Date(now.getTime() - staleAfterMs);
    const result = await this.prisma.managedResource.updateMany({
      where: {
        sourceType: { in: ['server', 'cloud'] },
        status: { notIn: ['stale', 'error'] },
        OR: [
          { lastSyncAt: { lt: cutoff } },
          { lastSyncAt: null, createdAt: { lt: cutoff } },
        ],
      },
      data: {
        status: 'stale',
        syncError: `Resource marked stale by scheduler; last successful sync is older than ${cutoff.toISOString()}`,
      },
    });

    return { marked: result.count, cutoff };
  }

  async runScheduledDockerSync() {
    if (!this.scheduledDockerSyncEnabled()) {
      return {
        enabled: false,
        attempted: 0,
        completed: 0,
        failed: 0,
      };
    }

    const servers = await this.prisma.server.findMany({
      where: {
        status: { not: 'offline' },
      },
      orderBy: { updatedAt: 'asc' },
      take: this.serverBatchSize(),
      select: {
        id: true,
        teamId: true,
      },
    });

    const summary = {
      enabled: true,
      attempted: 0,
      completed: 0,
      failed: 0,
    };

    for (const server of servers) {
      summary.attempted += 1;
      try {
        const environmentId = await this.primaryEnvironmentId(server.teamId, server.id);
        await this.resourceControlService.syncServerDocker(server.teamId, null, server.id, {
          scope: 'scheduled-docker',
          includeContainers: true,
          includeMiddleware: true,
          environmentId,
        });
        summary.completed += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(
          `Scheduled Docker sync failed for server ${server.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return summary;
  }

  async runScheduledDockerMetrics(now = new Date()) {
    if (!this.scheduledDockerMetricsEnabled()) {
      return {
        enabled: false,
        attempted: 0,
        submitted: 0,
        skippedRecent: 0,
        failed: 0,
      };
    }

    const resources = await this.prisma.managedResource.findMany({
      where: {
        sourceType: 'server',
        provider: 'docker',
        kind: 'docker_container',
        serverId: { not: null },
        status: { notIn: ['stale', 'error'] },
      },
      orderBy: { updatedAt: 'asc' },
      take: this.metricResourceBatchSize(),
      select: {
        id: true,
        teamId: true,
      },
    });
    const recentSnapshotByResourceId = await this.recentMetricSnapshotMap(
      resources.map((resource) => resource.id),
    );
    const minIntervalMs = this.metricsMinIntervalMs();
    const summary = {
      enabled: true,
      attempted: 0,
      submitted: 0,
      skippedRecent: 0,
      failed: 0,
    };

    for (const resource of resources) {
      const recentSnapshot = recentSnapshotByResourceId.get(resource.id);
      if (recentSnapshot && now.getTime() - recentSnapshot.getTime() < minIntervalMs) {
        summary.skippedRecent += 1;
        continue;
      }

      summary.attempted += 1;
      try {
        await this.resourceControlService.executeResourceAction(
          resource.teamId,
          null,
          resource.id,
          {
            action: 'docker.container.stats',
            dryRun: false,
            queue: true,
            maxAttempts: this.metricsMaxAttempts(),
          },
        );
        summary.submitted += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(
          `Scheduled Docker metrics collection failed for resource ${resource.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return summary;
  }

  private async recentMetricSnapshotMap(resourceIds: string[]) {
    if (resourceIds.length === 0) {
      return new Map<string, Date>();
    }

    const snapshots = await this.prisma.resourceMetricSnapshot.findMany({
      where: {
        resourceId: { in: resourceIds },
        metricSource: 'docker_stats',
      },
      orderBy: { sampledAt: 'desc' },
      select: {
        resourceId: true,
        sampledAt: true,
      },
    });
    const recent = new Map<string, Date>();
    for (const snapshot of snapshots) {
      if (!recent.has(snapshot.resourceId)) {
        recent.set(snapshot.resourceId, snapshot.sampledAt);
      }
    }
    return recent;
  }

  private async primaryEnvironmentId(teamId: string, serverId: string) {
    const binding = await this.prisma.projectEnvironmentServer.findFirst({
      where: {
        teamId,
        serverId,
        status: 'active',
        environment: { status: 'active' },
      },
      orderBy: { updatedAt: 'desc' },
      select: { environmentId: true },
    });

    return binding?.environmentId;
  }

  private emptySummary(skipped: boolean): ScheduledSyncSummary {
    return {
      skipped,
      staleMarked: 0,
      dockerSync: {
        enabled: this.scheduledDockerSyncEnabled(),
        attempted: 0,
        completed: 0,
        failed: 0,
      },
      dockerMetrics: {
        enabled: this.scheduledDockerMetricsEnabled(),
        attempted: 0,
        submitted: 0,
        skippedRecent: 0,
        failed: 0,
      },
    };
  }

  private schedulerEnabled() {
    return this.configService.get('RESOURCE_CONTROL_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private scheduledDockerSyncEnabled() {
    return this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_SYNC_ENABLED', 'true') === 'true';
  }

  private scheduledDockerMetricsEnabled() {
    return this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED', 'false') === 'true';
  }

  private schedulerIntervalMs() {
    const seconds = Number(this.configService.get('RESOURCE_CONTROL_SCHEDULER_INTERVAL_SECONDS', '300'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 30 ? seconds : 300;
    return safeSeconds * 1000;
  }

  private staleAfterMs() {
    const seconds = Number(this.configService.get('RESOURCE_CONTROL_STALE_AFTER_SECONDS', '86400'));
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return 0;
    }
    return seconds * 1000;
  }

  private serverBatchSize() {
    const size = Number(this.configService.get('RESOURCE_CONTROL_SCHEDULE_SERVER_BATCH_SIZE', '10'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 50) : 10;
  }

  private metricResourceBatchSize() {
    const size = Number(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  private metricsMaxAttempts() {
    const attempts = Number(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MAX_ATTEMPTS', '1'));
    return Number.isInteger(attempts) && attempts > 0 ? Math.min(attempts, 5) : 1;
  }

  private metricsMinIntervalMs() {
    const seconds = Number(this.configService.get('RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MIN_INTERVAL_SECONDS', '300'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 30 ? seconds : 300;
    return safeSeconds * 1000;
  }
}
