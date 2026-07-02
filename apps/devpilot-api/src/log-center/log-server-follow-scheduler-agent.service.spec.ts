import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LogCenterService } from './log-center.service';
import { LogServerFollowSchedulerService } from './log-server-follow-scheduler.service';

type PrismaMock = {
  logStream: { findMany: jest.Mock };
  logCollectionRun: { findFirst: jest.Mock };
};

describe('LogServerFollowSchedulerService live follow policies', () => {
  let prisma: PrismaMock;
  let logCenterService: { collectStream: jest.Mock };
  let service: LogServerFollowSchedulerService;

  beforeEach(() => {
    prisma = {
      logStream: { findMany: jest.fn().mockResolvedValue([]) },
      logCollectionRun: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    logCenterService = {
      collectStream: jest.fn().mockResolvedValue({
        status: 'queued',
        ingestedEntryCount: 0,
      }),
    };
    service = new LogServerFollowSchedulerService(
      prisma as unknown as PrismaService,
      logCenterService as unknown as LogCenterService,
      liveSchedulerConfig() as unknown as ConfigService,
    );
  });

  it('queues confirmed live server follow when scheduler dry-run is disabled', async () => {
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
          followMode: 'server',
          scheduledServerFollow: true,
        }),
      }),
    );
  });

  it('queues confirmed live agent follow with a server_agent transport requirement', async () => {
    prisma.logStream.findMany.mockResolvedValue([
      serverStream({
        sourceType: 'server_executor',
        metadata: {
          agentFollow: {
            enabled: true,
            live: true,
            confirmLiveRead: true,
            queue: true,
            tail: 60,
            maxAttempts: 2,
          },
        },
      }),
    ]);

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({
      dryRun: false,
      attempted: 1,
      queued: 1,
    }));
    expect(logCenterService.collectStream).toHaveBeenCalledWith(
      'team-1',
      null,
      'stream-1',
      expect.objectContaining({
        dryRun: false,
        queue: true,
        tail: 60,
        maxAttempts: 2,
        params: {
          scheduledAgentFollow: true,
          requiredTransport: 'server_agent',
          followMode: 'agent',
          sourceType: 'server_executor',
          confirmLiveRead: true,
        },
      }),
    );
  });
});

function liveSchedulerConfig() {
  return {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED: 'true',
        LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN: 'false',
        LOG_CENTER_SERVER_FOLLOW_SCHEDULER_SCAN_LIMIT: '5',
      };
      return values[key] ?? fallback;
    }),
  };
}

function serverStream(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stream-1',
    teamId: 'team-1',
    sourceType: 'docker',
    metadata: null,
    ...overrides,
  };
}
