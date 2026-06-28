import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LogCenterService } from './log-center.service';
import { LogRetentionSchedulerService } from './log-retention-scheduler.service';

type PrismaMock = {
  logStream: {
    findMany: jest.Mock;
  };
};

describe('LogRetentionSchedulerService', () => {
  let prisma: PrismaMock;
  let logCenterService: { cleanupRetention: jest.Mock };
  let config: { get: jest.Mock };
  let service: LogRetentionSchedulerService;

  beforeEach(() => {
    prisma = {
      logStream: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    logCenterService = {
      cleanupRetention: jest.fn().mockResolvedValue({
        status: 'completed',
        deletedEntryCount: 0,
      }),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          LOG_RETENTION_SCHEDULER_ENABLED: 'true',
          LOG_RETENTION_SCHEDULER_DRY_RUN: 'true',
          LOG_RETENTION_SCHEDULER_INTERVAL_SECONDS: '3600',
          LOG_RETENTION_SCHEDULER_BATCH_SIZE: '20',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new LogRetentionSchedulerService(
      prisma as unknown as PrismaService,
      logCenterService as unknown as LogCenterService,
      config as unknown as ConfigService,
    );
  });

  it('returns disabled summary when scheduler is off', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'LOG_RETENTION_SCHEDULER_ENABLED') return 'false';
      if (key === 'LOG_RETENTION_SCHEDULER_DRY_RUN') return 'true';
      return fallback;
    });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: false,
      dryRun: true,
      attempted: 0,
      completed: 0,
      failed: 0,
      deletedEntryCount: 0,
    });
    expect(prisma.logStream.findMany).not.toHaveBeenCalled();
  });

  it('runs dry-run cleanup for active streams in a bounded batch', async () => {
    prisma.logStream.findMany.mockResolvedValue([
      { id: 'stream-1', teamId: 'team-1' },
      { id: 'stream-2', teamId: 'team-2' },
    ]);

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: true,
      attempted: 2,
      completed: 2,
      failed: 0,
      deletedEntryCount: 0,
    });
    expect(prisma.logStream.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        retentionDays: { gt: 0 },
      },
      orderBy: [{ lastEntryAt: 'asc' }, { updatedAt: 'asc' }],
      take: 20,
      select: { id: true, teamId: true },
    });
    expect(logCenterService.cleanupRetention).toHaveBeenNthCalledWith(
      1,
      'team-1',
      null,
      'stream-1',
      { dryRun: true },
    );
    expect(logCenterService.cleanupRetention).toHaveBeenNthCalledWith(
      2,
      'team-2',
      null,
      'stream-2',
      { dryRun: true },
    );
  });

  it('can run live cleanup only when dry-run is explicitly disabled', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        LOG_RETENTION_SCHEDULER_ENABLED: 'true',
        LOG_RETENTION_SCHEDULER_DRY_RUN: 'false',
        LOG_RETENTION_SCHEDULER_BATCH_SIZE: '5',
      };
      return values[key] ?? fallback;
    });
    prisma.logStream.findMany.mockResolvedValue([{ id: 'stream-1', teamId: 'team-1' }]);
    logCenterService.cleanupRetention.mockResolvedValue({
      status: 'completed',
      deletedEntryCount: 12,
    });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: false,
      attempted: 1,
      completed: 1,
      failed: 0,
      deletedEntryCount: 12,
    });
    expect(prisma.logStream.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(logCenterService.cleanupRetention).toHaveBeenCalledWith(
      'team-1',
      null,
      'stream-1',
      { dryRun: false },
    );
  });

  it('continues after one cleanup run fails', async () => {
    prisma.logStream.findMany.mockResolvedValue([
      { id: 'stream-1', teamId: 'team-1' },
      { id: 'stream-2', teamId: 'team-1' },
    ]);
    logCenterService.cleanupRetention
      .mockRejectedValueOnce(new Error('db timeout'))
      .mockResolvedValueOnce({ status: 'completed', deletedEntryCount: 0 });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: true,
      attempted: 2,
      completed: 1,
      failed: 1,
      deletedEntryCount: 0,
    });
  });

  it('returns skipped summary when a scheduler tick is already running', async () => {
    prisma.logStream.findMany.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve([]), 10);
    }));

    const first = service.runOnce();
    await expect(service.runOnce()).resolves.toEqual({
      skipped: true,
      enabled: true,
      dryRun: true,
      attempted: 0,
      completed: 0,
      failed: 0,
      deletedEntryCount: 0,
    });
    await first;
  });
});
