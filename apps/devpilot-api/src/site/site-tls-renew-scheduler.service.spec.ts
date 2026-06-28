import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SiteTlsRenewSchedulerService } from './site-tls-renew-scheduler.service';
import { SiteService } from './site.service';

type PrismaMock = {
  site: {
    findMany: jest.Mock;
  };
  siteSyncRun: {
    findMany: jest.Mock;
  };
};

describe('SiteTlsRenewSchedulerService', () => {
  let prisma: PrismaMock;
  let siteService: { createTlsRenew: jest.Mock };
  let config: { get: jest.Mock };
  let service: SiteTlsRenewSchedulerService;

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
      createTlsRenew: jest.fn().mockResolvedValue({}),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          SITE_TLS_RENEW_SCHEDULER_ENABLED: 'true',
          SITE_TLS_RENEW_SCHEDULER_DRY_RUN: 'true',
          SITE_TLS_RENEW_SCHEDULER_INTERVAL_SECONDS: '86400',
          SITE_TLS_RENEW_SCHEDULER_BATCH_SIZE: '2',
          SITE_TLS_RENEW_MAX_ATTEMPTS: '2',
          SITE_TLS_RENEW_BEFORE_DAYS: '30',
          SITE_TLS_RENEW_MIN_INTERVAL_SECONDS: '86400',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new SiteTlsRenewSchedulerService(
      prisma as unknown as PrismaService,
      siteService as unknown as SiteService,
      config as unknown as ConfigService,
    );
  });

  it('returns disabled summary when scheduler is off', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => (
      key === 'SITE_TLS_RENEW_SCHEDULER_ENABLED' ? 'false' : fallback
    ));

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: false,
      dryRun: true,
      scanned: 0,
      attempted: 0,
      submitted: 0,
      skippedNotLetsEncrypt: 0,
      skippedMissingExpiry: 0,
      skippedNotDue: 0,
      skippedRecent: 0,
      failed: 0,
    });
    expect(prisma.site.findMany).not.toHaveBeenCalled();
    expect(prisma.siteSyncRun.findMany).not.toHaveBeenCalled();
  });

  it('queues dry-run renewal rehearsals only for due Let’s Encrypt sites', async () => {
    prisma.site.findMany.mockResolvedValue([
      siteCandidate('site-1', 'team-1', {
        enabled: true,
        type: 'letsencrypt',
        expiresAt: '2026-07-20T00:00:00.000Z',
      }),
      siteCandidate('site-2', 'team-1', {
        enabled: true,
        type: 'custom',
        expiresAt: '2026-07-01T00:00:00.000Z',
      }),
      siteCandidate('site-3', 'team-1', {
        enabled: true,
        type: 'letsencrypt',
      }),
      siteCandidate('site-4', 'team-1', {
        enabled: true,
        type: 'letsencrypt',
        expiresAt: '2026-09-01T00:00:00.000Z',
      }),
      siteCandidate('site-5', 'team-2', {
        enabled: true,
        type: 'letsencrypt',
        certificate: {
          notAfter: '2026-07-10T00:00:00.000Z',
        },
      }),
    ]);
    prisma.siteSyncRun.findMany.mockResolvedValue([
      {
        siteId: 'site-5',
        startedAt: new Date('2026-06-27T11:00:00.000Z'),
      },
    ]);

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: true,
      scanned: 5,
      attempted: 1,
      submitted: 1,
      skippedNotLetsEncrypt: 1,
      skippedMissingExpiry: 1,
      skippedNotDue: 1,
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
        siteId: { in: ['site-1', 'site-2', 'site-3', 'site-4', 'site-5'] },
        mode: 'tls_renew',
        startedAt: { gte: new Date('2026-06-26T12:00:00.000Z') },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        siteId: true,
        startedAt: true,
      },
    });
    expect(siteService.createTlsRenew).toHaveBeenCalledWith(
      'team-1',
      null,
      'site-1',
      {
        dryRun: true,
        queue: true,
        maxAttempts: 2,
      },
      'scheduled_tls_renew',
    );
  });

  it('can submit approval-gated live renewals when dry-run is explicitly disabled', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        SITE_TLS_RENEW_SCHEDULER_ENABLED: 'true',
        SITE_TLS_RENEW_SCHEDULER_DRY_RUN: 'false',
        SITE_TLS_RENEW_SCHEDULER_BATCH_SIZE: '5',
        SITE_TLS_RENEW_MAX_ATTEMPTS: '1',
        SITE_TLS_RENEW_BEFORE_DAYS: '30',
        SITE_TLS_RENEW_MIN_INTERVAL_SECONDS: '86400',
      };
      return values[key] ?? fallback;
    });
    prisma.site.findMany.mockResolvedValue([
      siteCandidate('site-1', 'team-1', {
        enabled: true,
        type: 'letsencrypt',
        expiresAt: '2026-07-01T00:00:00.000Z',
      }),
    ]);

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: false,
      scanned: 1,
      attempted: 1,
      submitted: 1,
      skippedNotLetsEncrypt: 0,
      skippedMissingExpiry: 0,
      skippedNotDue: 0,
      skippedRecent: 0,
      failed: 0,
    });
    expect(siteService.createTlsRenew).toHaveBeenCalledWith(
      'team-1',
      null,
      'site-1',
      {
        dryRun: false,
        queue: true,
        maxAttempts: 1,
      },
      'scheduled_tls_renew',
    );
  });

  it('continues after one renewal submission fails', async () => {
    prisma.site.findMany.mockResolvedValue([
      siteCandidate('site-1', 'team-1', {
        enabled: true,
        type: 'letsencrypt',
        expiresAt: '2026-07-01T00:00:00.000Z',
      }),
      siteCandidate('site-2', 'team-1', {
        enabled: true,
        type: 'letsencrypt',
        expiresAt: '2026-07-02T00:00:00.000Z',
      }),
    ]);
    siteService.createTlsRenew
      .mockRejectedValueOnce(new Error('approval store unavailable'))
      .mockResolvedValueOnce({});

    await expect(service.runOnce(new Date('2026-06-27T12:00:00.000Z'))).resolves.toEqual({
      skipped: false,
      enabled: true,
      dryRun: true,
      scanned: 2,
      attempted: 2,
      submitted: 1,
      skippedNotLetsEncrypt: 0,
      skippedMissingExpiry: 0,
      skippedNotDue: 0,
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
      dryRun: true,
      scanned: 0,
      attempted: 0,
      submitted: 0,
      skippedNotLetsEncrypt: 0,
      skippedMissingExpiry: 0,
      skippedNotDue: 0,
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
