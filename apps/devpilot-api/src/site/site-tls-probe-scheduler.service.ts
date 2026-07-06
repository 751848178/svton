import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { SiteService } from './site.service';

type JsonRecord = Record<string, unknown>;

type ScheduledSiteTlsProbeSummary = {
  skipped: boolean;
  enabled: boolean;
  scanned: number;
  attempted: number;
  submitted: number;
  skippedNotTls: number;
  skippedRecent: number;
  failed: number;
};

type SiteCandidate = {
  id: string;
  teamId: string;
  tls: Prisma.JsonValue | null;
};

@Injectable()
export class SiteTlsProbeSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(SiteTlsProbeSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly siteService: SiteService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'site-tls-probe';
  }

  isEnabled(): boolean {
    return this.configService.get('SITE_TLS_PROBE_SCHEDULER_ENABLED', 'false') === 'true';
  }

  intervalMs(): number {
    const seconds = Number(this.configService.get('SITE_TLS_PROBE_SCHEDULER_INTERVAL_SECONDS', '3600'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 3600;
    return safeSeconds * 1000;
  }

  async runOnce(now = new Date()): Promise<ScheduledSiteTlsProbeSummary> {
    if (!this.isEnabled()) {
      return this.emptySummary(false, false);
    }

    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, true);
    }

    try {
      const batchSize = this.batchSize();
      const candidates = await this.prisma.site.findMany({
        where: {
          serverId: { not: null },
          status: { not: 'error' },
        },
        orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
        take: Math.min(batchSize * 3, 100),
        select: {
          id: true,
          teamId: true,
          tls: true,
        },
      });
      const recentRunBySiteId = await this.recentTlsProbeRunMap(
        candidates.map((candidate) => candidate.id),
        now,
      );
      const summary: ScheduledSiteTlsProbeSummary = {
        skipped: false,
        enabled: true,
        scanned: candidates.length,
        attempted: 0,
        submitted: 0,
        skippedNotTls: 0,
        skippedRecent: 0,
        failed: 0,
      };

      for (const site of candidates) {
        if (summary.attempted >= batchSize) {
          break;
        }
        if (!this.siteUsesTls(site)) {
          summary.skippedNotTls += 1;
          continue;
        }
        if (this.siteRecentlyProbed(site, recentRunBySiteId.get(site.id), now)) {
          summary.skippedRecent += 1;
          continue;
        }

        summary.attempted += 1;
        try {
          await this.siteService.createTlsProbe(
            site.teamId,
            null,
            site.id,
            {
              dryRun: false,
              queue: true,
              maxAttempts: this.maxAttempts(),
            },
            'scheduled_tls_probe',
          );
          summary.submitted += 1;
        } catch (error) {
          summary.failed += 1;
          this.logger.warn(
            `Scheduled site TLS probe failed for site ${site.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return summary;
    } finally {
      this.releaseRunLock();
    }
  }

  private async recentTlsProbeRunMap(siteIds: string[], now: Date) {
    if (siteIds.length === 0) {
      return new Map<string, Date>();
    }

    const cutoff = new Date(now.getTime() - this.minProbeIntervalMs());
    const runs = await this.prisma.siteSyncRun.findMany({
      where: {
        siteId: { in: siteIds },
        mode: 'tls_probe',
        startedAt: { gte: cutoff },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        siteId: true,
        startedAt: true,
      },
    });
    const recent = new Map<string, Date>();
    for (const run of runs) {
      if (!recent.has(run.siteId)) {
        recent.set(run.siteId, run.startedAt);
      }
    }
    return recent;
  }

  private siteUsesTls(site: SiteCandidate) {
    const tls = isRecord(site.tls) ? site.tls : null;
    if (!tls) {
      return false;
    }

    const enabled = readBoolean(tls.enabled);
    if (enabled === true) {
      return true;
    }
    if (enabled === false) {
      return false;
    }

    const type = readString(tls.type);
    return Boolean(type && type !== 'none');
  }

  private siteRecentlyProbed(site: SiteCandidate, recentRunAt: Date | undefined, now: Date) {
    const recentFromTls = this.lastProbedAt(site.tls);
    const lastProbedAt = recentRunAt && recentFromTls
      ? (recentRunAt > recentFromTls ? recentRunAt : recentFromTls)
      : recentRunAt || recentFromTls;

    if (!lastProbedAt) {
      return false;
    }
    return now.getTime() - lastProbedAt.getTime() < this.minProbeIntervalMs();
  }

  private lastProbedAt(tls: unknown) {
    if (!isRecord(tls)) {
      return null;
    }

    return readDate(tls.lastProbedAt)
      || readDate(tls.probedAt)
      || (isRecord(tls.certificate) ? readDate(tls.certificate.probedAt) : null);
  }

  private emptySummary(skipped: boolean, enabled: boolean): ScheduledSiteTlsProbeSummary {
    return {
      skipped,
      enabled,
      scanned: 0,
      attempted: 0,
      submitted: 0,
      skippedNotTls: 0,
      skippedRecent: 0,
      failed: 0,
    };
  }

  private batchSize() {
    const size = Number(this.configService.get('SITE_TLS_PROBE_SCHEDULER_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  private maxAttempts() {
    const attempts = Number(this.configService.get('SITE_TLS_PROBE_MAX_ATTEMPTS', '1'));
    return Number.isInteger(attempts) && attempts > 0 ? Math.min(attempts, 5) : 1;
  }

  private minProbeIntervalMs() {
    const seconds = Number(this.configService.get('SITE_TLS_PROBE_MIN_INTERVAL_SECONDS', '21600'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 300 ? seconds : 21600;
    return safeSeconds * 1000;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
