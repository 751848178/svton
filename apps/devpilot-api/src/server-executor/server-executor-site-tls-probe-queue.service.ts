import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { mergeSiteTlsRenewFollowUpProbeMetadata } from "../site/site-tls-renew";
import { readOptionalString, toJsonValue } from "./server-executor-json.utils";
import {
  buildSiteTlsProbeCommandPlan,
  buildSiteTlsProbeExecutionInput,
  buildSiteTlsProbeWarnings,
} from "./server-executor-site-tls-follow-up.utils";
import {
  ServerExecutionInput,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

type QueueSiteTlsProbeExecution = (
  input: ServerExecutionInput,
  options?: { maxAttempts?: number; availableAt?: Date },
) => Promise<ServerQueuedExecutionResult>;

export class ServerExecutorSiteTlsProbeQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Pick<Logger, "warn">,
  ) {}

  async queueAfterRenewal(
    input: ServerExecutionInput,
    siteId: string,
    metadata: Record<string, unknown>,
    queueExecution: QueueSiteTlsProbeExecution,
  ) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, teamId: input.teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        serverId: true,
        primaryDomain: true,
        runtimeType: true,
        tls: true,
      },
    });

    if (!site) {
      return;
    }

    const sourceRenewalRunId = readOptionalString(metadata.siteSyncRunId);
    const queuedAt = new Date();
    const host = site.primaryDomain;
    const warnings = buildSiteTlsProbeWarnings(site.serverId, host);
    const commandPlan = buildSiteTlsProbeCommandPlan(host);
    let probeRunId: string | undefined;

    try {
      const probeRun = await this.prisma.siteSyncRun.create({
        data: {
          teamId: input.teamId,
          actorId: input.userId ?? undefined,
          siteId: site.id,
          projectId: site.projectId,
          environmentId: site.environmentId,
          serverId: site.serverId,
          sourceRunId: sourceRenewalRunId || undefined,
          mode: "tls_probe",
          trigger: "renewal_follow_up_tls_probe",
          executorKey: "server-executor",
          adapterKey: "nginx-site-plan",
          dryRun: false,
          status: "queued",
          targetConfigPath: `tls://${host}:443`,
          nginxConfig: "",
          commandPlan: toJsonValue(commandPlan),
          warnings: toJsonValue(warnings),
        },
      });
      probeRunId = probeRun.id;

      const queued = await queueExecution(
        buildSiteTlsProbeExecutionInput(input, site, commandPlan, warnings, {
          sourceRenewalRunId,
          probeRunId: probeRun.id,
          host,
        }),
        { maxAttempts: 1 },
      );

      await this.prisma.siteSyncRun.update({
        where: { id: probeRun.id },
        data: {
          status: queued.status,
          serverExecutionJobId: queued.serverExecutionJobId,
          executorKey: queued.executorKey,
          adapterKey: queued.adapterKey,
          commandPlan: toJsonValue(queued.commandSteps),
          executionPlan: queued.commandPlan,
          logs: queued.logs,
          result: queued.result,
          warnings: toJsonValue(queued.warnings),
          error: queued.error ?? null,
        },
      });

      await this.markFollowUpProbeQueued(
        input.teamId,
        site,
        sourceRenewalRunId,
        probeRun.id,
        queued.serverExecutionJobId,
        queuedAt,
      );
    } catch (error) {
      await this.markFollowUpProbeFailed(
        input.teamId,
        site,
        sourceRenewalRunId,
        probeRunId,
        error,
      );
    }
  }

  private async markFollowUpProbeQueued(
    teamId: string,
    site: { id: string; tls: unknown },
    sourceRenewalRunId: string | undefined,
    siteSyncRunId: string,
    serverExecutionJobId: string | undefined,
    queuedAt: Date,
  ) {
    await this.prisma.site.updateMany({
      where: { id: site.id, teamId },
      data: {
        tls: mergeSiteTlsRenewFollowUpProbeMetadata(site.tls, {
          status: "queued",
          sourceRenewalRunId,
          siteSyncRunId,
          serverExecutionJobId,
          queuedAt: queuedAt.toISOString(),
        }),
      },
    });
  }

  private async markFollowUpProbeFailed(
    teamId: string,
    site: { id: string; tls: unknown },
    sourceRenewalRunId: string | undefined,
    siteSyncRunId: string | undefined,
    error: unknown,
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "TLS renewal follow-up probe queue failed";
    this.logger.warn(
      `Failed to queue TLS probe after renewal for site ${site.id}: ${message}`,
    );

    if (siteSyncRunId) {
      await this.prisma.siteSyncRun.updateMany({
        where: { id: siteSyncRunId, teamId },
        data: { status: "failed", error: message, finishedAt: new Date() },
      });
    }

    await this.prisma.site.updateMany({
      where: { id: site.id, teamId },
      data: {
        tls: mergeSiteTlsRenewFollowUpProbeMetadata(site.tls, {
          status: "failed",
          sourceRenewalRunId,
          siteSyncRunId,
          failedAt: new Date().toISOString(),
          error: message,
        }),
      },
    });
  }
}
