/**
 * Resource-request provisioning queue worker.
 *
 * Extracted from `ResourceRequestService.processNextQueuedProvisioningRun` so
 * the recovery service stays under the 200-line ceiling. Claims the next due
 * queued HTTP provisioning run (team-scoped or global), validates it is still
 * current, then executes it inline via the provisioning orchestrator. Returns
 * a bounded `ProvisioningQueueProcessSummary`. No behavior change.
 */

import { Injectable } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceProvisioningRunWriterService } from './resource-provisioning-run-writer.service';
import { ResourceRequestProvisioningService } from './resource-request-provisioning.service';
import {
  JsonRecord,
  ProvisioningQueueProcessSummary,
  ResourceProvisioningRunRecord,
} from './resource-request.types';
import { ProcessQueuedResourceProvisioningRunDto } from './dto/resource-request.dto';
import {
  asRecord,
  dateToIso,
  errorMessage,
  readString,
} from './resource-provisioning-value.utils';
import {
  normalizeProvisioningProcessorTrigger,
} from './resource-provisioning-script.utils';
import { serializeProvisioningRun } from './resource-provisioning-run-serialize.utils';

@Injectable()
export class ResourceRequestQueueWorker {
  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly runWriter: ResourceProvisioningRunWriterService,
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly provisioning: ResourceRequestProvisioningService,
  ) {}

  async processNext(
    teamId: string | undefined,
    userId: string | undefined,
    dto: ProcessQueuedResourceProvisioningRunDto = {},
  ): Promise<ProvisioningQueueProcessSummary> {
    const now = new Date();
    const lockOwner = userId || 'resource-request-queue-worker';
    const run = await this.repo.findRunFirst({
      where: {
        ...(teamId ? { teamId } : {}),
        status: 'queued', queueMode: 'queued', mode: { in: ['api', 'webhook'] },
        ...(dto.runId ? { id: dto.runId } : { OR: [{ availableAt: null }, { availableAt: { lte: now } }] }),
      },
      orderBy: [{ availableAt: 'asc' }, { startedAt: 'asc' }],
      include: {
        request: { include: this.statusWriter.requestInclude() },
        actor: { select: { id: true, name: true, email: true } },
        resourceType: { select: { id: true, key: true, name: true } },
        _count: { select: { replayAttempts: true } },
      },
    });

    if (!run) {
      return { scanned: 0, processed: 0, skipped: 0, failed: 0,
        reason: dto.runId ? 'queued_run_not_found' : 'queue_empty' };
    }

    const claim = await this.repo.updateRuns({
      where: { id: run.id, ...(teamId ? { teamId } : {}), status: 'queued', queueMode: 'queued' },
      data: { status: 'running', startedAt: now, lockedAt: now, lockOwner },
    });

    if (claim.count !== 1) {
      return { scanned: 1, processed: 0, skipped: 1, failed: 0,
        reason: 'queue_claim_conflict', run: serializeProvisioningRun(run) };
    }

    const claimedRun = { ...run, status: 'running', startedAt: now, lockedAt: now, lockOwner } as ResourceProvisioningRunRecord;
    const request = asRecord(run.request);
    const currentProvisioning = asRecord(asRecord(request.result).provisioning);
    const currentRunId = readString(currentProvisioning.provisioningRunId);

    if (request.status !== 'approved' || currentRunId !== run.id) {
      const reason = request.status !== 'approved' ? 'queued_request_not_approved' : 'queued_run_not_current';
      const skippedProvisioning: JsonRecord = {
        ...currentProvisioning, mode: run.mode, status: 'failed',
        boundary: run.boundary || 'http_adapter', provisioningRunId: run.id,
        replayOfRunId: run.replayOfRunId || undefined, idempotencyKey: run.idempotencyKey,
        queueMode: run.queueMode || 'queued', queuedAt: dateToIso(run.queuedAt),
        availableAt: dateToIso(run.availableAt), reason, retryable: false, failedAt: now.toISOString(),
      };
      await this.runWriter.finishProvisioningRun(claimedRun, skippedProvisioning);
      await this.statusWriter.writeAudit({
        teamId: run.teamId as string, actorId: userId,
        resourceTypeId: run.resourceTypeId as string, requestId: run.requestId as string,
        provisioningRunId: run.id as string, action: 'provisioning.queue_skipped',
        message: '跳过不再可执行的资源交付队列运行', metadata: skippedProvisioning,
      });
      return { scanned: 1, processed: 0, skipped: 1, failed: 0, reason,
        run: serializeProvisioningRun({ ...claimedRun, status: 'failed', error: reason, finishedAt: now }) };
    }

    try {
      const processed = await this.provisioning.runApprovedProvisioningProcessor(
        run.teamId as string, userId, request,
        {
          trigger: normalizeProvisioningProcessorTrigger(run.trigger),
          replayOfRunId: readString(run.replayOfRunId) || undefined,
          provisioningRunId: run.id as string, forceInline: true,
        },
      );
      return { scanned: 1, processed: 1, skipped: 0, failed: 0,
        run: serializeProvisioningRun(claimedRun), request: processed };
    } catch (error) {
      const reason = errorMessage(error);
      const failedProvisioning: JsonRecord = {
        ...currentProvisioning, mode: run.mode, status: 'failed',
        boundary: run.boundary || 'http_adapter', provisioningRunId: run.id,
        replayOfRunId: run.replayOfRunId || undefined, idempotencyKey: run.idempotencyKey,
        queueMode: run.queueMode || 'queued', queuedAt: dateToIso(run.queuedAt),
        availableAt: dateToIso(run.availableAt), reason, retryable: true, failedAt: now.toISOString(),
      };
      await this.runWriter.finishProvisioningRun(claimedRun, failedProvisioning);
      await this.statusWriter.writeAudit({
        teamId: run.teamId as string, actorId: userId,
        resourceTypeId: run.resourceTypeId as string, requestId: run.requestId as string,
        provisioningRunId: run.id as string, action: 'provisioning.queue_failed',
        message: '资源交付队列运行执行失败', metadata: failedProvisioning,
      });
      return { scanned: 1, processed: 0, skipped: 0, failed: 1, reason,
        run: serializeProvisioningRun({ ...claimedRun, status: 'failed', error: reason, finishedAt: now }) };
    }
  }
}
