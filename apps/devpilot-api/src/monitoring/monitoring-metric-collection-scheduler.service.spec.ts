import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceControlService } from '../resource-control/resource-control.service';
import { MonitoringSchedulerConfigService } from './monitoring-scheduler-config.service';
import { MonitoringMetricCollectionSchedulerService } from './monitoring-metric-collection-scheduler.service';

type PrismaMock = {
  managedResource: {
    findMany: jest.Mock;
  };
};

describe('MonitoringMetricCollectionSchedulerService', () => {
  let prisma: PrismaMock;
  let resourceControlService: {
    executeResourceAction: jest.Mock;
  };
  let config: { get: jest.Mock };
  let schedulerConfig: MonitoringSchedulerConfigService;
  let service: MonitoringMetricCollectionSchedulerService;

  beforeEach(() => {
    prisma = {
      managedResource: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    resourceControlService = {
      executeResourceAction: jest.fn().mockResolvedValue({}),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          MONITORING_AUTO_COLLECT_ENABLED: 'true',
          MONITORING_AUTO_COLLECT_INTERVAL_MS: '60000',
          MONITORING_AUTO_COLLECT_BATCH_SIZE: '50',
        };
        return values[key] ?? fallback;
      }),
    };
    schedulerConfig = new MonitoringSchedulerConfigService(
      config as unknown as ConfigService,
    );
    service = new MonitoringMetricCollectionSchedulerService(
      prisma as unknown as PrismaService,
      resourceControlService as unknown as ResourceControlService,
      schedulerConfig,
    );
  });

  it('exposes monitoring-metric-collection as scheduler name and reflects config', () => {
    expect(service.schedulerName()).toBe('monitoring-metric-collection');
    expect(service.isEnabled()).toBe(true);
    expect(service.intervalMs()).toBe(60000);
  });

  it('is disabled when the feature flag is off', () => {
    config.get.mockImplementation((key: string, fallback?: string) =>
      key === 'MONITORING_AUTO_COLLECT_ENABLED' ? 'false' : fallback,
    );
    expect(service.isEnabled()).toBe(false);
  });

  it('collects metrics for each running docker server resource via the existing action', async () => {
    prisma.managedResource.findMany.mockResolvedValue([
      resource('res-1', 'team-a', 'web-1'),
      resource('res-2', 'team-b', 'db-1'),
    ]);

    await expect(
      service.runOnce(new Date('2026-07-23T12:00:00.000Z')),
    ).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 2,
      attempted: 2,
      completed: 2,
      failed: 0,
    });

    expect(prisma.managedResource.findMany).toHaveBeenCalledWith({
      where: {
        provider: 'docker',
        sourceType: 'server',
        status: { in: ['running', 'active'] },
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
      select: { id: true, teamId: true, name: true },
    });
    expect(resourceControlService.executeResourceAction).toHaveBeenCalledTimes(
      2,
    );
    expect(resourceControlService.executeResourceAction).toHaveBeenNthCalledWith(
      1,
      'team-a',
      null,
      'res-1',
      { action: 'docker.container.stats', dryRun: false },
    );
    expect(resourceControlService.executeResourceAction).toHaveBeenNthCalledWith(
      2,
      'team-b',
      null,
      'res-2',
      { action: 'docker.container.stats', dryRun: false },
    );
  });

  it('continues collecting after one resource fails (best-effort)', async () => {
    prisma.managedResource.findMany.mockResolvedValue([
      resource('res-1', 'team-a', 'web-1'),
      resource('res-2', 'team-a', 'db-1'),
    ]);
    resourceControlService.executeResourceAction
      .mockRejectedValueOnce(new Error('executor down'))
      .mockResolvedValueOnce({});

    await expect(
      service.runOnce(new Date('2026-07-23T12:00:00.000Z')),
    ).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 2,
      attempted: 2,
      completed: 1,
      failed: 1,
    });
    expect(resourceControlService.executeResourceAction).toHaveBeenCalledTimes(
      2,
    );
  });

  it('skips and scans nothing when no resources match', async () => {
    await expect(
      service.runOnce(new Date('2026-07-23T12:00:00.000Z')),
    ).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
    });
    expect(resourceControlService.executeResourceAction).not.toHaveBeenCalled();
  });

  it('returns a skipped summary when a tick is already running', async () => {
    prisma.managedResource.findMany.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([]), 10);
        }),
    );

    const first = service.runOnce(new Date('2026-07-23T12:00:00.000Z'));
    await expect(
      service.runOnce(new Date('2026-07-23T12:00:00.000Z')),
    ).resolves.toEqual({
      skipped: true,
      enabled: true,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
    });
    await first;
  });

  it('clamps a sub-minimum interval back to the 60s default', () => {
    config.get.mockImplementation((key: string, fallback?: string) =>
      key === 'MONITORING_AUTO_COLLECT_INTERVAL_MS'
        ? '5000'
        : fallback,
    );
    expect(service.intervalMs()).toBe(60000);
  });
});

function resource(id: string, teamId: string, name: string) {
  return { id, teamId, name };
}
