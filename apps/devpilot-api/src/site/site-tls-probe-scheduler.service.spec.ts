import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SiteTlsProbeSchedulerService } from './site-tls-probe-scheduler.service';
import { SiteService } from './site.service';

type PrismaMock = {
  site: {
    findMany: jest.Mock;
  };
  siteSyncRun: {
    findMany: jest.Mock;
  };
};

describe('SiteTlsProbeSchedulerService', () => {
  let prisma: PrismaMock;
  let siteService: { createTlsProbe: jest.Mock };
  let config: { get: jest.Mock };
  let service: SiteTlsProbeSchedulerService;

  beforeEach(() => {
    prisma = {
      site: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      siteSyncRun: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    siteService = {
      createTlsProbe: jest.fn().mockResolvedValue({}),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          SITE_TLS_PROBE_SCHEDULER_ENABLED: 'true',
          SITE_TLS_PROBE_SCHEDULER_INTERVAL_SECONDS: '3600',
          SITE_TLS_PROBE_SCHEDULER_BATCH_SIZE: '2',
          SITE_TLS_PROBE_MAX_ATTEMPTS: '2',
          SITE_TLS_PROBE_MIN_INTERVAL_SECONDS: '3600',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new SiteTlsProbeSchedulerService(
      prisma as unknown as PrismaService,
      siteService as unknown as SiteService,
      config as unknown as ConfigService,
    );
  });

  it('returns disabled summary when scheduler is off', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => (
      key === 'SITE_TLS_PROBE_SCHEDULER_ENABLED' ? 'false' : fallback
    ));

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: false,
      scanned: 0,
      attempted: 0,
      submitted: 0,
      skippedNotTls: 0,
      skippedRecent: 0,
      failed: 0,
    });
    expect(prisma.site.findMany).not.toHaveBeenCalled();
    expect(prisma.siteSyncRun.findMany).not.toHaveBeenCalled();
  });

  it('queues scheduled TLS probes only for eligible sites that are due', async () => {
    prisma.site.findMany.mockResolvedValue([
      siteCandidate('site-1', 'team-1', {
        enabled: true,
        type: 'letsencrypt',
        lastProbedAt: '2026-06-27T06:00:00.000Z',
      }),
      siteCandidate('site-2', 'team-1', {
        enabled: false,
        type: 'none',
      }),
      siteCandidate('site-3', 'team-1', {
        enabled: true,
        type: 'custom',
      }),
      siteCandidate('site-4', 'team-2', {
        type: 'custom',
      }),
    ]);
    prisma.siteSyncRun.findMany.mockResolvedValue([
      {
        siteId: 'site-3',
        startedAt: new Date('2026-06-27T11:50:00.000Z'),
      },
    ]);

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 4,
      attempted: 2,
      submitted: 2,
      skippedNotTls: 1,
      skippedRecent: 1,
      failed: 0,
    });
    expect(prisma.site.findMany).toHaveBeenCalledWith({
      where: {
        serverId: { not: null },
        status: { not: 'error' },
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      take: 6,
      select: {
        id: true,
        teamId: true,
        tls: true,
      },
    });
    expect(prisma.siteSyncRun.findMany).toHaveBeenCalledWith({
      where: {
        siteId: { in: ['site-1', 'site-2', 'site-3', 'site-4'] },
        mode: 'tls_probe',
        startedAt: { gte: new Date('2026-06-27T11:00:00.000Z') },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        siteId: true,
        startedAt: true,
      },
    });
    expect(siteService.createTlsProbe).toHaveBeenNthCalledWith(
      1,
      'team-1',
      null,
      'site-1',
      {
        dryRun: false,
        queue: true,
        maxAttempts: 2,
      },
      'scheduled_tls_probe',
    );
    expect(siteService.createTlsProbe).toHaveBeenNthCalledWith(
      2,
      'team-2',
      null,
      'site-4',
      {
        dryRun: false,
        queue: true,
        maxAttempts: 2,
      },
      'scheduled_tls_probe',
    );
  });

  it('continues after one scheduled TLS probe submission fails', async () => {
    prisma.site.findMany.mockResolvedValue([
      siteCandidate('site-1', 'team-1', { enabled: true }),
      siteCandidate('site-2', 'team-1', { enabled: true }),
    ]);
    siteService.createTlsProbe
      .mockRejectedValueOnce(new Error('queue unavailable'))
      .mockResolvedValueOnce({});

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 2,
      attempted: 2,
      submitted: 1,
      skippedNotTls: 0,
      skippedRecent: 0,
      failed: 1,
    });
  });

  it('returns skipped summary when a scheduler tick is already running', async () => {
    prisma.site.findMany.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve([]), 10);
    }));

    const first = service.runOnce(new Date('2026-06-27T12:00:00.000Z'));
    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: true,
      enabled: true,
      scanned: 0,
      attempted: 0,
      submitted: 0,
      skippedNotTls: 0,
      skippedRecent: 0,
      failed: 0,
    });
    await first;
  });
});

function siteCandidate(id: string, teamId: string, tls: Record<string, unknown>) {
  return {
    id,
    teamId,
    tls,
  };
}
