import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
import { SiteService } from './site.service';

type JsonRecord = Record<string, unknown>;

type ScheduledSiteTlsRenewSummary = {
  skipped: boolean;
  enabled: boolean;
  dryRun: boolean;
  scanned: number;
  attempted: number;
  submitted: number;
  skippedNotLetsEncrypt: number;
  skippedMissingExpiry: number;
  skippedNotDue: number;
  skippedRecent: number;
  failed: number;
};

type SiteRenewCandidate = {
  id: string;
  teamId: string;
  tls: Prisma.JsonValue | null;
};

@Injectable()
export class SiteTlsRenewSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(SiteTlsRenewSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly siteService: SiteService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'site-tls-renew';
  }

  isEnabled(): boolean {
    return this.schedulerEnabled();
  }

  intervalMs(): number {
    return this.schedulerIntervalMs();
  }

  async runOnce(now = new Date()): Promise<ScheduledSiteTlsRenewSummary> {
    if (!this.schedulerEnabled()) {
      return this.emptySummary(false, false);
    }

    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, true);
    }

    try {
      const batchSize = this.batchSize();
      const dryRun = this.schedulerDryRun();
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
      const recentRunBySiteId = await this.recentTlsRenewRunMap(
        candidates.map((candidate) => candidate.id),
        now,
      );
      const summary: ScheduledSiteTlsRenewSummary = {
        skipped: false,
        enabled: true,
        dryRun,
        scanned: candidates.length,
        attempted: 0,
        submitted: 0,
        skippedNotLetsEncrypt: 0,
        skippedMissingExpiry: 0,
        skippedNotDue: 0,
        skippedRecent: 0,
        failed: 0,
      };

      for (const site of candidates) {
        if (summary.attempted >= batchSize) {
          break;
        }
        if (!this.siteUsesLetsEncrypt(site)) {
          summary.skippedNotLetsEncrypt += 1;
          continue;
        }
        const expiresAt = this.certificateExpiresAt(site.tls);
        if (!expiresAt) {
          summary.skippedMissingExpiry += 1;
          continue;
        }
        if (!this.certificateDue(expiresAt, now)) {
          summary.skippedNotDue += 1;
          continue;
        }
        if (this.siteRecentlyRenewed(recentRunBySiteId.get(site.id), now)) {
          summary.skippedRecent += 1;
          continue;
        }

        summary.attempted += 1;
        try {
          await this.siteService.createTlsRenew(
            site.teamId,
            null,
            site.id,
            {
              dryRun,
              queue: true,
              maxAttempts: this.maxAttempts(),
            },
            'scheduled_tls_renew',
          );
          summary.submitted += 1;
        } catch (error) {
          summary.failed += 1;
          this.logger.warn(
            `Scheduled site TLS renewal failed for site ${site.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return summary;
    } finally {
      this.releaseRunLock();
    }
  }

  private async recentTlsRenewRunMap(siteIds: string[], now: Date) {
    if (siteIds.length === 0) {
      return new Map<string, Date>();
    }

    const cutoff = new Date(now.getTime() - this.minRenewIntervalMs());
    const runs = await this.prisma.siteSyncRun.findMany({
      where: {
        siteId: { in: siteIds },
        mode: 'tls_renew',
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

  private siteUsesLetsEncrypt(site: SiteRenewCandidate) {
    const tls = isRecord(site.tls) ? site.tls : null;
    return readBoolean(tls?.enabled) === true && readString(tls?.type) === 'letsencrypt';
  }

  private certificateExpiresAt(tls: unknown) {
    if (!isRecord(tls)) {
      return null;
    }

    const certificate = isRecord(tls.certificate) ? tls.certificate : {};
    return readDate(tls.expiresAt)
      || readDate(tls.notAfter)
      || readDate(tls.certificateExpiresAt)
      || readDate(certificate.expiresAt)
      || readDate(certificate.notAfter);
  }

  private certificateDue(expiresAt: Date, now: Date) {
    return expiresAt.getTime() - now.getTime() <= this.renewBeforeMs();
  }

  private siteRecentlyRenewed(recentRunAt: Date | undefined, now: Date) {
    if (!recentRunAt) {
      return false;
    }
    return now.getTime() - recentRunAt.getTime() < this.minRenewIntervalMs();
  }

  private emptySummary(skipped: boolean, enabled: boolean): ScheduledSiteTlsRenewSummary {
    return {
      skipped,
      enabled,
      dryRun: this.schedulerDryRun(),
      scanned: 0,
      attempted: 0,
      submitted: 0,
      skippedNotLetsEncrypt: 0,
      skippedMissingExpiry: 0,
      skippedNotDue: 0,
      skippedRecent: 0,
      failed: 0,
    };
  }

  private schedulerEnabled() {
    return this.configService.get('SITE_TLS_RENEW_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private schedulerDryRun() {
    return this.configService.get('SITE_TLS_RENEW_SCHEDULER_DRY_RUN', 'true') !== 'false';
  }

  private schedulerIntervalMs() {
    const seconds = Number(this.configService.get('SITE_TLS_RENEW_SCHEDULER_INTERVAL_SECONDS', '86400'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 3600 ? seconds : 86400;
    return safeSeconds * 1000;
  }

  private batchSize() {
    const size = Number(this.configService.get('SITE_TLS_RENEW_SCHEDULER_BATCH_SIZE', '20'));
    return Number.isInteger(size) && size > 0 ? Math.min(size, 100) : 20;
  }

  private maxAttempts() {
    const attempts = Number(this.configService.get('SITE_TLS_RENEW_MAX_ATTEMPTS', '1'));
    return Number.isInteger(attempts) && attempts > 0 ? Math.min(attempts, 5) : 1;
  }

  private renewBeforeMs() {
    const days = Number(this.configService.get('SITE_TLS_RENEW_BEFORE_DAYS', '30'));
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
    return safeDays * 24 * 60 * 60 * 1000;
  }

  private minRenewIntervalMs() {
    const seconds = Number(this.configService.get('SITE_TLS_RENEW_MIN_INTERVAL_SECONDS', '86400'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 3600 ? seconds : 86400;
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
