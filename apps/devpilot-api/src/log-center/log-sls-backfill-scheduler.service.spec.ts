import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LogCenterService } from './log-center.service';
import { LogSlsBackfillSchedulerService } from './log-sls-backfill-scheduler.service';

type PrismaMock = {
  logStream: {
    findMany: jest.Mock;
  };
  logCollectionRun: {
    findFirst: jest.Mock;
  };
};

describe('LogSlsBackfillSchedulerService', () => {
  let prisma: PrismaMock;
  let logCenterService: { collectStream: jest.Mock };
  let config: { get: jest.Mock };
  let service: LogSlsBackfillSchedulerService;

  beforeEach(() => {
    prisma = {
      logStream: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      logCollectionRun: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    logCenterService = {
      collectStream: jest.fn().mockResolvedValue({
        status: 'completed',
        ingestedEntryCount: 0,
      }),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          LOG_CENTER_SLS_BACKFILL_SCHEDULER_ENABLED: 'true',
          LOG_CENTER_SLS_BACKFILL_SCHEDULER_DRY_RUN: 'true',
          LOG_CENTER_SLS_BACKFILL_SCHEDULER_INTERVAL_SECONDS: '300',
          LOG_CENTER_SLS_BACKFILL_SCHEDULER_SCAN_LIMIT: '20',
          LOG_CENTER_SLS_BACKFILL_DEFAULT_INTERVAL_MINUTES: '15',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new LogSlsBackfillSchedulerService(
      prisma as unknown as PrismaService,
      logCenterService as unknown as LogCenterService,
      config as unknown as ConfigService,
    );
  });

  it('returns disabled summary when scheduler is off', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'LOG_CENTER_SLS_BACKFILL_SCHEDULER_ENABLED') return 'false';
      if (key === 'LOG_CENTER_SLS_BACKFILL_SCHEDULER_DRY_RUN') return 'true';
      return fallback;
    });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: false,
      dryRun: true,
      scanned: 0,
      attempted: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skippedStreams: 0,
      ingestedEntryCount: 0,
    });
    expect(prisma.logStream.findMany).not.toHaveBeenCalled();
  });

  it('runs dry-run SLS backfill only for opted-in active SLS streams', async () => {
    prisma.logStream.findMany.mockResolvedValue([
      slsStream({
        id: 'stream-1',
        metadata: {
          slsBackfill: {
            enabled: true,
            query: 'level:error',
            windowMinutes: 30,
            limit: 25,
            intervalMinutes: 10,
          },
        },
      }),
      slsStream({ id: 'stream-2', metadata: { slsBackfill: { enabled: false } } }),
    ]);

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: true,
      scanned: 2,
      attempted: 1,
      completed: 1,
      failed: 0,
      blocked: 0,
      skippedStreams: 1,
      ingestedEntryCount: 0,
    });
    expect(prisma.logStream.findMany).toHaveBeenCalledWith({
      where: { status: 'active', sourceType: 'sls' },
      orderBy: [{ lastEntryAt: 'asc' }, { updatedAt: 'asc' }],
      take: 20,
      select: { id: true, teamId: true, sourceKey: true, metadata: true },
    });
    expect(prisma.logCollectionRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        teamId: 'team-1',
        streamId: 'stream-1',
        sourceType: 'sls',
        startedAt: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    }));
    expect(logCenterService.collectStream).toHaveBeenCalledWith(
      'team-1',
      null,
      'stream-1',
      {
        dryRun: true,
        tail: 25,
        params: {
          query: 'level:error',
          windowMinutes: 30,
          limit: 25,
          logstore: 'app-log',
          confirmLiveRead: false,
          scheduledBackfill: true,
        },
      },
    );
  });

  it('skips streams with a recent collection run inside the configured interval', async () => {
    prisma.logStream.findMany.mockResolvedValue([
      slsStream({
        metadata: { slsBackfill: { enabled: true, intervalMinutes: 20 } },
      }),
    ]);
    prisma.logCollectionRun.findFirst.mockResolvedValue({ id: 'recent-run' });

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({
      scanned: 1,
      attempted: 0,
      skippedStreams: 1,
    }));
    expect(logCenterService.collectStream).not.toHaveBeenCalled();
  });

  it('can run live SLS backfill only when scheduler dry-run is disabled and stream confirms live read', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        LOG_CENTER_SLS_BACKFILL_SCHEDULER_ENABLED: 'true',
        LOG_CENTER_SLS_BACKFILL_SCHEDULER_DRY_RUN: 'false',
        LOG_CENTER_SLS_BACKFILL_SCHEDULER_SCAN_LIMIT: '5',
      };
      return values[key] ?? fallback;
    });
    prisma.logStream.findMany.mockResolvedValue([
      slsStream({
        metadata: {
          slsBackfill: {
            enabled: true,
            live: true,
            confirmLiveRead: true,
            query: '*',
          },
        },
      }),
    ]);
    logCenterService.collectStream.mockResolvedValue({
      status: 'completed',
      ingestedEntryCount: 3,
    });

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({
      dryRun: false,
      attempted: 1,
      completed: 1,
      ingestedEntryCount: 3,
    }));
    expect(logCenterService.collectStream).toHaveBeenCalledWith(
      'team-1',
      null,
      'stream-1',
      expect.objectContaining({
        dryRun: false,
        params: expect.objectContaining({
          confirmLiveRead: true,
        }),
      }),
    );
  });

  it('blocks live SLS backfill when stream live read is not confirmed', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'LOG_CENTER_SLS_BACKFILL_SCHEDULER_ENABLED') return 'true';
      if (key === 'LOG_CENTER_SLS_BACKFILL_SCHEDULER_DRY_RUN') return 'false';
      return fallback;
    });
    prisma.logStream.findMany.mockResolvedValue([
      slsStream({
        metadata: {
          slsBackfill: {
            enabled: true,
            live: true,
            confirmLiveRead: false,
          },
        },
      }),
    ]);

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({
      attempted: 0,
      blocked: 1,
    }));
    expect(logCenterService.collectStream).not.toHaveBeenCalled();
  });
});

function slsStream(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stream-1',
    teamId: 'team-1',
    sourceKey: 'app-log',
    metadata: null,
    ...overrides,
  };
}
