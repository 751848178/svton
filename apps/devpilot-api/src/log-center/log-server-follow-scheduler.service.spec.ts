import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LogCenterService } from './log-center.service';
import { LogServerFollowSchedulerService } from './log-server-follow-scheduler.service';

type PrismaMock = {
  logStream: {
    findMany: jest.Mock;
  };
  logCollectionRun: {
    findFirst: jest.Mock;
  };
};

describe('LogServerFollowSchedulerService', () => {
  let prisma: PrismaMock;
  let logCenterService: { collectStream: jest.Mock };
  let config: { get: jest.Mock };
  let service: LogServerFollowSchedulerService;

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
          LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED: 'true',
          LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN: 'true',
          LOG_CENTER_SERVER_FOLLOW_SCHEDULER_INTERVAL_SECONDS: '300',
          LOG_CENTER_SERVER_FOLLOW_SCHEDULER_SCAN_LIMIT: '20',
          LOG_CENTER_SERVER_FOLLOW_DEFAULT_INTERVAL_MINUTES: '5',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new LogServerFollowSchedulerService(
      prisma as unknown as PrismaService,
      logCenterService as unknown as LogCenterService,
      config as unknown as ConfigService,
    );
  });

  it('returns disabled summary when scheduler is off', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED') return 'false';
      if (key === 'LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN') return 'true';
      return fallback;
    });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: false,
      dryRun: true,
      scanned: 0,
      attempted: 0,
      queued: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skippedStreams: 0,
      ingestedEntryCount: 0,
    });
    expect(prisma.logStream.findMany).not.toHaveBeenCalled();
  });

  it('runs dry-run server follow only for opted-in active server-side streams', async () => {
    prisma.logStream.findMany.mockResolvedValue([
      serverStream({
        id: 'stream-1',
        sourceType: 'docker',
        metadata: {
          serverFollow: {
            enabled: true,
            tail: 80,
            intervalMinutes: 3,
          },
        },
      }),
      serverStream({ id: 'stream-2', sourceType: 'nginx', metadata: { serverFollow: { enabled: false } } }),
    ]);

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: true,
      scanned: 2,
      attempted: 1,
      queued: 0,
      completed: 1,
      failed: 0,
      blocked: 0,
      skippedStreams: 1,
      ingestedEntryCount: 0,
    });
    expect(prisma.logStream.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        sourceType: { in: ['docker', 'nginx', 'server_executor'] },
      },
      orderBy: [{ lastEntryAt: 'asc' }, { updatedAt: 'asc' }],
      take: 20,
      select: { id: true, teamId: true, sourceType: true, metadata: true },
    });
    expect(prisma.logCollectionRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        teamId: 'team-1',
        streamId: 'stream-1',
        sourceType: { in: ['docker', 'nginx', 'server_executor'] },
        startedAt: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    }));
    expect(logCenterService.collectStream).toHaveBeenCalledWith(
      'team-1',
      null,
      'stream-1',
      {
        dryRun: true,
        queue: false,
        tail: 80,
        maxAttempts: 3,
        params: {
          scheduledServerFollow: true,
          sourceType: 'docker',
          confirmLiveRead: false,
        },
      },
    );
  });

  it('skips streams with a recent server follow run inside the configured interval', async () => {
    prisma.logStream.findMany.mockResolvedValue([
      serverStream({
        metadata: { serverFollow: { enabled: true, intervalMinutes: 20 } },
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

  it('queues confirmed live server follow when scheduler dry-run is disabled', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED: 'true',
        LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN: 'false',
        LOG_CENTER_SERVER_FOLLOW_SCHEDULER_SCAN_LIMIT: '5',
      };
      return values[key] ?? fallback;
    });
    prisma.logStream.findMany.mockResolvedValue([
      serverStream({
        metadata: {
          serverFollow: {
            enabled: true,
            live: true,
            confirmLiveRead: true,
            queue: true,
            tail: 100,
            maxAttempts: 4,
          },
        },
      }),
    ]);
    logCenterService.collectStream.mockResolvedValue({
      status: 'queued',
      ingestedEntryCount: 0,
    });

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({
      dryRun: false,
      attempted: 1,
      queued: 1,
      completed: 0,
    }));
    expect(logCenterService.collectStream).toHaveBeenCalledWith(
      'team-1',
      null,
      'stream-1',
      expect.objectContaining({
        dryRun: false,
        queue: true,
        tail: 100,
        maxAttempts: 4,
        params: expect.objectContaining({
          confirmLiveRead: true,
          scheduledServerFollow: true,
        }),
      }),
    );
  });

  it('blocks live server follow when stream live read is not confirmed', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED') return 'true';
      if (key === 'LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN') return 'false';
      return fallback;
    });
    prisma.logStream.findMany.mockResolvedValue([
      serverStream({
        metadata: {
          serverFollow: {
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

function serverStream(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stream-1',
    teamId: 'team-1',
    sourceType: 'docker',
    metadata: null,
    ...overrides,
  };
}
