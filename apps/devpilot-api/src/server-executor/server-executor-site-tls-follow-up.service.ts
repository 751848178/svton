import { PrismaService } from "../prisma/prisma.service";
import {
  extractSiteTlsProbeMetadata,
  mergeSiteTlsProbeMetadata,
} from "../site/site-tls-probe";
import {
  extractSiteTlsRenewMetadata,
  mergeSiteTlsRenewMetadata,
  SiteTlsRenewMetadata,
} from "../site/site-tls-renew";
import {
  isRecord,
  readOptionalString,
  readPositiveInteger,
} from "./server-executor-json.utils";
import { ServerExecutorSiteTlsProbeQueueService } from "./server-executor-site-tls-probe-queue.service";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

type QueueSiteTlsProbeExecution = (
  input: ServerExecutionInput,
  options?: { maxAttempts?: number; availableAt?: Date },
) => Promise<ServerQueuedExecutionResult>;

export class ServerExecutorSiteTlsFollowUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly probeQueueService: ServerExecutorSiteTlsProbeQueueService,
  ) {}

  async refreshAfterProbe(
    teamId: string,
    siteId: string,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, teamId },
      select: { id: true, tls: true, primaryDomain: true },
    });

    if (!site) {
      return;
    }

    const currentTls = isRecord(site.tls) ? site.tls : {};
    const probe = extractSiteTlsProbeMetadata({
      host: readOptionalString(metadata.tlsProbeHost) || site.primaryDomain,
      port: readPositiveInteger(metadata.tlsProbePort) || 443,
      result: result.result,
      logs: result.logs,
      currentType: readOptionalString(currentTls.type),
    });

    if (!probe) {
      return;
    }

    await this.prisma.site.updateMany({
      where: { id: site.id, teamId },
      data: { tls: mergeSiteTlsProbeMetadata(site.tls, probe) },
    });
  }

  async refreshAfterRenew(
    teamId: string,
    siteId: string,
    dryRun: boolean,
    result: ServerExecutionResult,
    metadata: Record<string, unknown>,
  ): Promise<SiteTlsRenewMetadata | null> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, teamId },
      select: { id: true, tls: true },
    });

    if (!site) {
      return null;
    }

    const renewal = extractSiteTlsRenewMetadata({
      result: result.result,
      logs: result.logs,
      executionStatus: result.status,
      dryRun,
      runId: readOptionalString(metadata.siteSyncRunId),
    });

    await this.prisma.site.updateMany({
      where: { id: site.id, teamId },
      data: { tls: mergeSiteTlsRenewMetadata(site.tls, renewal) },
    });

    return renewal;
  }

  async queueProbeAfterRenewal(
    input: ServerExecutionInput,
    siteId: string,
    metadata: Record<string, unknown>,
    queueExecution: QueueSiteTlsProbeExecution,
  ) {
    await this.probeQueueService.queueAfterRenewal(
      input,
      siteId,
      metadata,
      queueExecution,
    );
  }
}
