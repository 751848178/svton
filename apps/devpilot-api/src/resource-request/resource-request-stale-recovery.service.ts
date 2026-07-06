/**
 * Stale provisioning-run recovery service.
 *
 * Owns the stale-running HTTP run recovery flow (global + team-scoped):
 * scans for running `api`/`webhook` runs older than the stale threshold,
 * marks each failed, writes the recovery audit, and — when the run is still
 * the request's current run — rewrites the request to `blocked`. Extracted
 * from `ResourceRequestRecoveryService` so that service stays under the
 * 200-line ceiling. Behavior preserved verbatim.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import {
  JsonRecord,
  ProvisioningStaleRecoverySummary,
} from './resource-request.types';
import { RecoverStaleResourceProvisioningRunsDto } from './dto/resource-request.dto';
import {
  asRecord,
  errorMessage,
  readListLimit,
  readNonNegativeInteger,
  readPositiveInteger,
  readString,
} from './resource-provisioning-value.utils';

@Injectable()
export class ResourceRequestStaleRecoveryService {
  private readonly logger = new Logger(ResourceRequestStaleRecoveryService.name);

  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly configService: ConfigService,
  ) {}

  readStaleProvisioningRunAfterSeconds(value?: unknown) {
    const configured = readPositiveInteger(
      this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS', '1800'),
    ) || 1800;
    return Math.max(readPositiveInteger(value) || configured, 60);
  }

  async recoverTeamStaleProvisioningRuns(
    teamId: string,
    dto: RecoverStaleResourceProvisioningRunsDto = {},
  ) {
    return this.recoverStaleProvisioningRuns({
      teamId,
      limit: readListLimit(dto.limit, 10, 100),
      staleAfterSeconds: this.readStaleProvisioningRunAfterSeconds(dto.staleAfterSeconds),
    });
  }

  async recoverStaleProvisioningRuns(
    options: { teamId?: string; limit?: number; now?: Date; staleAfterSeconds?: number } = {},
  ): Promise<ProvisioningStaleRecoverySummary> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const now = options.now ?? new Date();
    const staleAfterSeconds = this.readStaleProvisioningRunAfterSeconds(options.staleAfterSeconds);
    const staleBefore = new Date(now.getTime() - staleAfterSeconds * 1000);
    const runs = await this.repo.findRuns({
      where: {
        ...(options.teamId ? { teamId: options.teamId } : {}),
        status: 'running', mode: { in: ['api', 'webhook'] }, startedAt: { lt: staleBefore },
      },
      orderBy: { startedAt: 'asc' }, take: limit,
      include: { request: { include: this.statusWriter.requestInclude() } },
    });

    const summary: ProvisioningStaleRecoverySummary = {
      scanned: runs.length, recovered: 0, requestUpdated: 0, skipped: 0, failed: 0,
    };

    for (const run of runs) {
      try {
        await this.recoverStaleRun(run, now, staleBefore, staleAfterSeconds, summary);
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`ResourceRequest provisioning run stale recovery failed: ${errorMessage(error)}`);
      }
    }
    return summary;
  }

  private async recoverStaleRun(
    run: JsonRecord, now: Date, staleBefore: Date, staleAfterSeconds: number,
    summary: ProvisioningStaleRecoverySummary,
  ) {
    const request = asRecord(run.request);
    const currentProvisioning = asRecord(asRecord(request.result).provisioning);
    const currentRunId = readString(currentProvisioning.provisioningRunId);
    const shouldUpdateRequest = request.status === 'approved' && currentRunId === run.id;
    const recoveryReason = 'stale_running_recovered';
    const recovery = {
      reason: recoveryReason, recoveredAt: now.toISOString(), staleAfterSeconds,
      staleBefore: staleBefore.toISOString(), previousStatus: run.status,
      currentRequestRun: shouldUpdateRequest,
    };
    const recoveryCount = (readNonNegativeInteger(run.recoveryCount) || 0) + 1;
    const recoveredRunProvisioning = {
      ...asRecord(asRecord(run.result).provisioning),
      mode: run.mode, status: 'failed', boundary: run.boundary || 'http_adapter',
      provisioningRunId: run.id, idempotencyKey: run.idempotencyKey,
      reason: recoveryReason, retryable: true, recoveredAt: now.toISOString(), recovery,
    };

    await this.repo.updateRun({
      where: { id: run.id },
      data: {
        status: 'failed', retryable: true, error: recoveryReason,
        result: { ...asRecord(run.result), provisioning: recoveredRunProvisioning, recovery },
        finishedAt: now, recoveredAt: now, recoveryReason, recoveryCount,
      },
    });
    await this.statusWriter.writeAudit({
      teamId: run.teamId as string, resourceTypeId: run.resourceTypeId as string,
      requestId: run.requestId as string, provisioningRunId: run.id as string,
      action: 'provisioning.run_stale_recovered', message: '恢复超时未结束的资源交付运行', metadata: recovery,
    });
    summary.recovered += 1;

    if (shouldUpdateRequest) {
      await this.statusWriter.markProvisioningStatus(run.teamId as string, undefined, request, {
        ...currentProvisioning, mode: run.mode, status: 'blocked',
        boundary: run.boundary || 'http_adapter', provisioningRunId: run.id,
        idempotencyKey: run.idempotencyKey, reason: recoveryReason, retryable: true,
        recoveredAt: now.toISOString(), recovery,
      });
      summary.requestUpdated += 1;
    } else {
      summary.skipped += 1;
    }
  }
}
