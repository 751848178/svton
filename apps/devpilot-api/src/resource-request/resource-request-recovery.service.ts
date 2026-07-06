/**
 * Resource-request recovery / queue / supervisor service.
 *
 * Owns the background-and-manual recovery surface: HTTP provisioning auto-retry
 * scanning, manual run replay, the queue process-next worker entry, and the
 * read-only provisioning run supervisor. Stale-running-run recovery lives in
 * `ResourceRequestStaleRecoveryService`; provider-state reconciliation + polling
 * live in `ResourceProviderStateService`. Extracted from `ResourceRequestService`
 * so the god service stops carrying these orchestration flows. Behavior preserved
 * verbatim — identical repository / writer calls, audit actions, summary shapes.
 */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceProvisioningRunWriterService } from './resource-provisioning-run-writer.service';
import { ResourceRequestProvisioningService } from './resource-request-provisioning.service';
import { ResourceProvisioningRunSupervisorService } from './resource-provisioning-run-supervisor.service';
import { ResourceRequestStaleRecoveryService } from './resource-request-stale-recovery.service';
import { ResourceRequestQueueWorker } from './resource-request-queue-worker.service';
import {
  JsonRecord,
  ProvisioningAutoRetrySummary,
  ProvisioningQueueProcessSummary,
  ProvisioningStaleRecoverySummary,
} from './resource-request.types';
import {
  ProcessQueuedResourceProvisioningRunDto,
  RecoverStaleResourceProvisioningRunsDto,
  ResourceProvisioningRunSupervisorQueryDto,
} from './dto/resource-request.dto';
import {
  asRecord,
  errorMessage,
  readString,
} from './resource-provisioning-value.utils';
import {
  isProvisioningAutoRetryDue,
} from './resource-provisioning-http-retry.utils';
import {
  isReplayableExternalProvisioningMode,
  normalizeProvisioningMode,
} from './resource-provisioning-script.utils';
import { serializeProvisioningRun } from './resource-provisioning-run-serialize.utils';

@Injectable()
export class ResourceRequestRecoveryService {
  private readonly logger = new Logger(ResourceRequestRecoveryService.name);

  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly runWriter: ResourceProvisioningRunWriterService,
    private readonly provisioning: ResourceRequestProvisioningService,
    private readonly provisioningRunSupervisorService: ResourceProvisioningRunSupervisorService,
    private readonly staleRecovery: ResourceRequestStaleRecoveryService,
  ) {}

  readStaleProvisioningRunAfterSeconds(value?: unknown) {
    return this.staleRecovery.readStaleProvisioningRunAfterSeconds(value);
  }

  async getProvisioningRunSupervisor(teamId: string, query: ResourceProvisioningRunSupervisorQueryDto = {}) {
    return this.provisioningRunSupervisorService.getSupervisorSnapshot(
      teamId, query, (run) => serializeProvisioningRun(run as JsonRecord),
    );
  }

  async replayProvisioningRun(teamId: string, userId: string, requestId: string, runId: string) {
    const existing = await this.getRequestOrFail(teamId, requestId);
    const run = await this.repo.findRunFirst({ where: { id: runId, teamId, requestId } });
    if (!run) throw new NotFoundException('资源交付运行不存在');
    const mode = normalizeProvisioningMode(run.mode);
    if (!isReplayableExternalProvisioningMode(mode)) {
      throw new BadRequestException('只有外部交付运行可以重放');
    }
    const runStatus = readString(run.status);
    if (!['planned', 'blocked', 'failed'].includes(runStatus)) {
      throw new BadRequestException('只有已生成计划、已阻断或失败的交付运行可以重放');
    }
    const currentProvisioning = asRecord(asRecord(existing.result).provisioning);
    if (readString(currentProvisioning.provisioningRunId) !== run.id) {
      throw new BadRequestException('只能重放当前资源申请正在指向的交付运行');
    }
    return this.provisioning.retryProvisioningRecord(teamId, userId, existing, {
      trigger: 'manual_retry', replayOfRunId: run.id, replaySourceStatus: runStatus,
    });
  }

  async recoverTeamStaleProvisioningRuns(teamId: string, dto: RecoverStaleResourceProvisioningRunsDto = {}) {
    return this.staleRecovery.recoverTeamStaleProvisioningRuns(teamId, dto);
  }

  async recoverStaleProvisioningRuns(
    options: { teamId?: string; limit?: number; now?: Date; staleAfterSeconds?: number } = {},
  ): Promise<ProvisioningStaleRecoverySummary> {
    return this.staleRecovery.recoverStaleProvisioningRuns(options);
  }

  async processDueProvisioningAutoRetries(
    options: { limit?: number; now?: Date } = {},
  ): Promise<ProvisioningAutoRetrySummary> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const now = options.now ?? new Date();
    const requests = await this.repo.findRequests({
      where: { status: 'approved' },
      include: this.statusWriter.requestInclude(),
      orderBy: { updatedAt: 'asc' },
      take: Math.min(limit * 5, 250),
    });
    const summary: ProvisioningAutoRetrySummary = {
      scanned: requests.length, attempted: 0, completed: 0, blocked: 0, skipped: 0, failed: 0,
    };
    for (const request of requests) {
      if (summary.attempted >= limit) break;
      if (!isProvisioningAutoRetryDue(request, now)) { summary.skipped += 1; continue; }
      summary.attempted += 1;
      try {
        const result = await this.provisioning.retryProvisioningRecord(
          request.teamId as string, undefined, request, { trigger: 'auto_retry' },
        );
        const resultProvisioning = asRecord(asRecord(result.result).provisioning);
        const status = readString(resultProvisioning.status);
        if (status === 'completed') summary.completed += 1;
        else if (status === 'blocked') summary.blocked += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`ResourceRequest provisioning auto retry failed: ${errorMessage(error)}`);
      }
    }
    return summary;
  }

  async processNextQueuedProvisioningRun(
    teamId: string | undefined,
    userId: string | undefined,
    dto: ProcessQueuedResourceProvisioningRunDto = {},
  ): Promise<ProvisioningQueueProcessSummary> {
    const queueWorker = new ResourceRequestQueueWorker(
      this.repo, this.runWriter, this.statusWriter, this.provisioning,
    );
    return queueWorker.processNext(teamId, userId, dto);
  }

  private async getRequestOrFail(teamId: string, id: string) {
    const request = await this.repo.findRequestFirst({
      where: { id, teamId },
      include: {
        ...this.statusWriter.requestInclude(),
        auditLogs: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!request) throw new NotFoundException('资源申请不存在');
    return request;
  }
}
