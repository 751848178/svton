/**
 * Site post-sync update service.
 *
 * Owns the post-execution site/TLS status updates: `updateSiteAfterSync`,
 * `updateSiteAfterNonMutatingOperation`, `updateSiteTlsAfterProbe`,
 * `updateSiteTlsAfterRenew`, and `queueTlsProbeAfterRenewal`. The TLS-renew
 * path queues a follow-up TLS probe via an injected callback to avoid a
 * circular dependency with the host's `createTlsProbe`. Extracted from
 * `SiteService`. Behavior preserved verbatim.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutionResult } from '../server-executor';
import { CreateSiteTlsProbeDto } from './dto/site.dto';
import { SITE_INCLUDE } from './site-includes.utils';
import {
  isRecord,
  readString,
  type SiteOperationMode,
  type SiteOperationTrigger,
} from './site-plan.types';
import { extractSiteTlsProbeMetadata, mergeSiteTlsProbeMetadata } from './site-tls-probe';
import {
  extractSiteTlsRenewMetadata,
  mergeSiteTlsRenewFollowUpProbeMetadata,
  mergeSiteTlsRenewMetadata,
} from './site-tls-renew';

export type SiteRecord = any;

export type CreateTlsProbeCallback = (
  teamId: string,
  userId: string | null,
  siteId: string,
  dto: CreateSiteTlsProbeDto,
  trigger: SiteOperationTrigger,
  sourceRunId?: string | null,
) => Promise<{ syncRun?: { id?: string; serverExecutionJobId?: string | null } }>;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : '站点同步执行异常';
}

@Injectable()
export class SitePostSyncUpdateService {
  private readonly logger = new Logger(SitePostSyncUpdateService.name);
  private createTlsProbe: CreateTlsProbeCallback | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Wire the host's createTlsProbe to break the circular dependency. */
  setCreateTlsProbeCallback(callback: CreateTlsProbeCallback) {
    this.createTlsProbe = callback;
  }

  async updateSiteAfterSync(siteId: string, status: ServerExecutionResult['status'], error?: string) {
    return this.prisma.site.update({
      where: { id: siteId },
      data: {
        status: status === 'completed' ? 'active' : 'error',
        lastSyncAt: new Date(),
        syncError: status === 'completed' ? null : error || '站点同步执行未完成',
      },
      include: SITE_INCLUDE,
    });
  }

  async updateSiteAfterNonMutatingOperation(
    teamId: string,
    userId: string | null,
    site: SiteRecord,
    execution: ServerExecutionResult,
    dryRun: boolean,
    mode: SiteOperationMode,
    runId: string,
  ): Promise<SiteRecord> {
    if (mode === 'tls_probe') return this.updateSiteTlsAfterProbe(site, execution, dryRun, mode);
    if (mode === 'tls_renew') return this.updateSiteTlsAfterRenew(teamId, userId, site, execution, dryRun, runId);
    return site;
  }

  private async updateSiteTlsAfterProbe(site: SiteRecord, execution: ServerExecutionResult, dryRun: boolean, mode: SiteOperationMode) {
    if (dryRun || mode !== 'tls_probe' || execution.status !== 'completed') return site;
    const tls = isRecord(site.tls) ? site.tls : {};
    const metadata = extractSiteTlsProbeMetadata({
      host: site.primaryDomain, port: 443, result: execution.result, logs: execution.logs, currentType: readString(tls.type),
    });
    if (!metadata) return site;
    return this.prisma.site.update({ where: { id: site.id }, data: { tls: mergeSiteTlsProbeMetadata(site.tls, metadata) }, include: SITE_INCLUDE });
  }

  private async updateSiteTlsAfterRenew(teamId: string, userId: string | null, site: SiteRecord, execution: ServerExecutionResult, dryRun: boolean, runId: string): Promise<SiteRecord> {
    if (execution.status !== 'completed' && execution.status !== 'failed') return site;
    const metadata = extractSiteTlsRenewMetadata({ result: execution.result, logs: execution.logs, executionStatus: execution.status, dryRun, runId });
    const renewedSite = await this.prisma.site.update({ where: { id: site.id }, data: { tls: mergeSiteTlsRenewMetadata(site.tls, metadata) }, include: SITE_INCLUDE });
    if (!dryRun && execution.status === 'completed' && metadata.succeeded) return this.queueTlsProbeAfterRenewal(teamId, userId, renewedSite, runId);
    return renewedSite;
  }

  private async queueTlsProbeAfterRenewal(teamId: string, userId: string | null, site: SiteRecord, sourceRenewalRunId: string): Promise<SiteRecord> {
    try {
      if (!this.createTlsProbe) return site;
      const probe = await this.createTlsProbe(teamId, userId, site.id, { dryRun: false, queue: true, maxAttempts: 1 }, 'renewal_follow_up_tls_probe', sourceRenewalRunId);
      const syncRun = probe.syncRun;
      return this.prisma.site.update({
        where: { id: site.id },
        data: { tls: mergeSiteTlsRenewFollowUpProbeMetadata(site.tls, { status: 'queued', sourceRenewalRunId, siteSyncRunId: syncRun?.id, serverExecutionJobId: syncRun?.serverExecutionJobId || undefined, queuedAt: new Date().toISOString() }) },
        include: SITE_INCLUDE,
      });
    } catch (error) {
      this.logger.warn(`Failed to queue TLS probe after renewal for site ${site.id}: ${errorMessage(error)}`);
      return this.prisma.site.update({
        where: { id: site.id },
        data: { tls: mergeSiteTlsRenewFollowUpProbeMetadata(site.tls, { status: 'failed', sourceRenewalRunId, failedAt: new Date().toISOString(), error: errorMessage(error) }) },
        include: SITE_INCLUDE,
      });
    }
  }
}
