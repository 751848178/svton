import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceControlSchedulerService } from './resource-control-scheduler.service';
import { ResourceControlService } from './resource-control.service';

type PrismaMock = {
  managedResource: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  resourceMetricSnapshot: {
    findMany: jest.Mock;
  };
  server: {
    findMany: jest.Mock;
  };
  projectEnvironmentServer: {
    findFirst: jest.Mock;
  };
};

describe('ResourceControlSchedulerService', () => {
  let prisma: PrismaMock;
  let resourceControlService: { executeResourceAction: jest.Mock; syncServerDocker: jest.Mock };
  let config: { get: jest.Mock };
  let service: ResourceControlSchedulerService;

  beforeEach(() => {
    prisma = {
      managedResource: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      resourceMetricSnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      server: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      projectEnvironmentServer: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    resourceControlService = {
      executeResourceAction: jest.fn().mockResolvedValue({}),
      syncServerDocker: jest.fn().mockResolvedValue({}),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          RESOURCE_CONTROL_SCHEDULER_ENABLED: 'false',
          RESOURCE_CONTROL_SCHEDULE_DOCKER_SYNC_ENABLED: 'true',
          RESOURCE_CONTROL_SCHEDULER_INTERVAL_SECONDS: '300',
          RESOURCE_CONTROL_STALE_AFTER_SECONDS: '86400',
          RESOURCE_CONTROL_SCHEDULE_SERVER_BATCH_SIZE: '10',
          RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED: 'false',
          RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_BATCH_SIZE: '20',
          RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MAX_ATTEMPTS: '1',
          RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MIN_INTERVAL_SECONDS: '300',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new ResourceControlSchedulerService(
      prisma as unknown as PrismaService,
      resourceControlService as unknown as ResourceControlService,
      config as unknown as ConfigService,
    );
  });

  it('marks old server and cloud resources as stale without touching manual or error records', async () => {
    prisma.managedResource.updateMany.mockResolvedValue({ count: 3 });
    const now = new Date('2026-06-26T12:00:00.000Z');

    await expect(service.markStaleResources(now)).resolves.toEqual({
      marked: 3,
      cutoff: new Date('2026-06-25T12:00:00.000Z'),
    });

    expect(prisma.managedResource.updateMany).toHaveBeenCalledWith({
      where: {
        sourceType: { in: ['server', 'cloud'] },
        status: { notIn: ['stale', 'error'] },
        OR: [
          { lastSyncAt: { lt: new Date('2026-06-25T12:00:00.000Z') } },
          { lastSyncAt: null, createdAt: { lt: new Date('2026-06-25T12:00:00.000Z') } },
        ],
      },
      data: {
        status: 'stale',
        syncError: 'Resource marked stale by scheduler; last successful sync is older than 2026-06-25T12:00:00.000Z',
      },
    });
  });

  it('runs scheduled Docker sync for servers and carries primary environment context', async () => {
    prisma.server.findMany.mockResolvedValue([
      { id: 'server-1', teamId: 'team-1' },
      { id: 'server-2', teamId: 'team-1' },
    ]);
    prisma.projectEnvironmentServer.findFirst
      .mockResolvedValueOnce({ environmentId: 'env-prod' })
      .mockResolvedValueOnce(null);
    resourceControlService.syncServerDocker
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(service.runScheduledDockerSync()).resolves.toEqual({
      enabled: true,
      attempted: 2,
      completed: 2,
      failed: 0,
    });

    expect(prisma.server.findMany).toHaveBeenCalledWith({
      where: { status: { not: 'offline' } },
      orderBy: { updatedAt: 'asc' },
      take: 10,
      select: { id: true, teamId: true },
    });
    expect(resourceControlService.syncServerDocker).toHaveBeenNthCalledWith(
      1,
      'team-1',
      null,
      'server-1',
      {
        scope: 'scheduled-docker',
        includeContainers: true,
        includeMiddleware: true,
        environmentId: 'env-prod',
      },
    );
    expect(resourceControlService.syncServerDocker).toHaveBeenNthCalledWith(
      2,
      'team-1',
      null,
      'server-2',
      {
        scope: 'scheduled-docker',
        includeContainers: true,
        includeMiddleware: true,
        environmentId: undefined,
      },
    );
  });

  it('continues scheduled sync after one server fails', async () => {
    prisma.server.findMany.mockResolvedValue([
      { id: 'server-1', teamId: 'team-1' },
      { id: 'server-2', teamId: 'team-1' },
    ]);
    resourceControlService.syncServerDocker
      .mockRejectedValueOnce(new Error('ssh unavailable'))
      .mockResolvedValueOnce({});

    await expect(service.runScheduledDockerSync()).resolves.toEqual({
      enabled: true,
      attempted: 2,
      completed: 1,
      failed: 1,
    });
  });

  it('returns a skipped summary when a scheduler tick is already running', async () => {
    prisma.managedResource.updateMany.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ count: 0 }), 10);
    }));

    const first = service.runOnce(new Date('2026-06-26T12:00:00.000Z'));
    await expect(service.runOnce(new Date('2026-06-26T12:00:00.000Z'))).resolves.toEqual({
      skipped: true,
      staleMarked: 0,
      dockerSync: {
        enabled: true,
        attempted: 0,
        completed: 0,
        failed: 0,
      },
      dockerMetrics: {
        enabled: false,
        attempted: 0,
        submitted: 0,
        skippedRecent: 0,
        failed: 0,
      },
    });
    await first;
  });

  it('keeps scheduled Docker metrics disabled by default', async () => {
    await expect(service.runScheduledDockerMetrics()).resolves.toEqual({
      enabled: false,
      attempted: 0,
      submitted: 0,
      skippedRecent: 0,
      failed: 0,
    });

    expect(prisma.managedResource.findMany).not.toHaveBeenCalled();
    expect(resourceControlService.executeResourceAction).not.toHaveBeenCalled();
  });

  it('queues Docker metrics for resources without a recent snapshot', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED: 'true',
        RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_BATCH_SIZE: '5',
        RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MAX_ATTEMPTS: '2',
        RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MIN_INTERVAL_SECONDS: '300',
      };
      return values[key] ?? fallback;
    });
    prisma.managedResource.findMany.mockResolvedValue([
      { id: 'resource-1', teamId: 'team-1' },
      { id: 'resource-2', teamId: 'team-1' },
    ]);
    prisma.resourceMetricSnapshot.findMany.mockResolvedValue([
      { resourceId: 'resource-2', sampledAt: new Date('2026-06-26T11:59:00.000Z') },
    ]);

    await expect(service.runScheduledDockerMetrics(new Date('2026-06-26T12:00:00.000Z'))).resolves.toEqual({
      enabled: true,
      attempted: 1,
      submitted: 1,
      skippedRecent: 1,
      failed: 0,
    });

    expect(prisma.managedResource.findMany).toHaveBeenCalledWith({
      where: {
        sourceType: 'server',
        provider: 'docker',
        kind: 'docker_container',
        serverId: { not: null },
        status: { notIn: ['stale', 'error'] },
      },
      orderBy: { updatedAt: 'asc' },
      take: 5,
      select: {
        id: true,
        teamId: true,
      },
    });
    expect(prisma.resourceMetricSnapshot.findMany).toHaveBeenCalledWith({
      where: {
        resourceId: { in: ['resource-1', 'resource-2'] },
        metricSource: 'docker_stats',
      },
      orderBy: { sampledAt: 'desc' },
      select: {
        resourceId: true,
        sampledAt: true,
      },
    });
    expect(resourceControlService.executeResourceAction).toHaveBeenCalledWith(
      'team-1',
      null,
      'resource-1',
      {
        action: 'docker.container.stats',
        dryRun: false,
        queue: true,
        maxAttempts: 2,
      },
    );
  });

  it('continues scheduled Docker metrics after one resource submission fails', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => (
      key === 'RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED' ? 'true' : fallback
    ));
    prisma.managedResource.findMany.mockResolvedValue([
      { id: 'resource-1', teamId: 'team-1' },
      { id: 'resource-2', teamId: 'team-1' },
    ]);
    resourceControlService.executeResourceAction
      .mockRejectedValueOnce(new Error('queue unavailable'))
      .mockResolvedValueOnce({});

    await expect(service.runScheduledDockerMetrics(new Date('2026-06-26T12:00:00.000Z'))).resolves.toEqual({
      enabled: true,
      attempted: 2,
      submitted: 1,
      skippedRecent: 0,
      failed: 1,
    });
  });
});
