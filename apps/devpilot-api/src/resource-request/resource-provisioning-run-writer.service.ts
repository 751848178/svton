/**
 * Resource provisioning-run lifecycle writer.
 *
 * Owns the `ResourceProvisioningRun` row lifecycle: creating a run (inline or
 * queued, including queue-replay lookup), attaching a redacted credential ref,
 * marking a request queued/blocked/planned with a run, and the terminal run
 * update (`finishProvisioningRun`). Extracted from `ResourceRequestService` so
 * the provisioning adapters and recovery flows share one run-write boundary.
 * Depends on `ResourceRequestStatusWriterService` for the request-status +
 * audit writes that accompany a run transition. Behavior preserved verbatim.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import {
  buildFinishProvisioningRunData,
  buildProvisioningRunCreateData,
} from './resource-provisioning-run-record.utils';
import {
  ExternalProvisioningRunMode,
  JsonRecord,
  ProvisioningMode,
  ProvisioningProcessorContext,
  ProvisioningQueueConfig,
  ProvisioningCredentialRef,
  ResourceProvisioningRunRecord,
} from './resource-request.types';
import { dateToIso } from './resource-provisioning-value.utils';

@Injectable()
export class ResourceProvisioningRunWriterService {
  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly statusWriter: ResourceRequestStatusWriterService,
  ) {}

  async createProvisioningRun(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    resourceType: { id: string; key: string },
    mode: ExternalProvisioningRunMode,
    context: ProvisioningProcessorContext,
    config: JsonRecord,
    createInput: {
      method?: string;
      url?: string;
      idempotencyKey: string;
      maxAttempts: number;
      queue: ProvisioningQueueConfig;
      boundary?: string;
      executorKey?: string;
      adapterKey?: string;
      params?: JsonRecord;
    },
  ): Promise<ResourceProvisioningRunRecord> {
    if (context.provisioningRunId) {
      const existingRun = await this.repo.findRunFirst({
        where: {
          id: context.provisioningRunId,
          teamId,
          requestId: request.id,
        },
      });

      if (!existingRun) {
        throw new NotFoundException('资源交付运行不存在');
      }

      return existingRun as ResourceProvisioningRunRecord;
    }

    const now = new Date();
    const queuedAt = createInput.queue.enabled ? now : undefined;
    const availableAt = createInput.queue.enabled
      ? new Date(now.getTime() + createInput.queue.delaySeconds * 1000)
      : undefined;

    const data = buildProvisioningRunCreateData({
      teamId,
      userId,
      request,
      resourceType,
      mode,
      context,
      config,
      createInput,
      queuedAt,
      availableAt,
    });

    const run = await this.repo.createRun({ data });
    return run as ResourceProvisioningRunRecord;
  }

  async attachProvisioningRunCredentialRef(
    run: ResourceProvisioningRunRecord,
    credentialRef: ProvisioningCredentialRef | null,
  ) {
    if (!credentialRef) {
      return;
    }

    await this.repo.updateRun({
      where: { id: run.id },
      data: {
        credentialId: credentialRef.referenceId,
        authAdapterKey: credentialRef.authAdapterKey,
      },
    });
  }

  async markProvisioningQueuedWithRun(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    input: {
      mode: Extract<ProvisioningMode, 'webhook' | 'api'>;
      method: string;
      url?: string;
      idempotencyKey: string;
      queue: ProvisioningQueueConfig;
    },
    run: ResourceProvisioningRunRecord,
  ) {
    return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
      mode: input.mode,
      status: 'queued',
      boundary: 'http_adapter',
      method: input.method,
      url: input.url,
      idempotencyKey: input.idempotencyKey,
      provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
      queueMode: 'queued',
      queueDelaySeconds: input.queue.delaySeconds,
      queuedAt: dateToIso(run.queuedAt) || new Date().toISOString(),
      availableAt: dateToIso(run.availableAt),
      reason: 'http_dispatch_queued',
    });
  }

  async markProvisioningStatusWithRun(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    provisioning: JsonRecord,
    run: ResourceProvisioningRunRecord,
  ) {
    const provisioningWithRun = {
      ...provisioning,
      provisioningRunId: run.id,
      replayOfRunId: run.replayOfRunId || undefined,
    };
    const updated = await this.statusWriter.markProvisioningStatus(
      teamId,
      userId,
      request,
      provisioningWithRun,
    );
    await this.finishProvisioningRun(run, provisioningWithRun);
    return updated;
  }

  async finishProvisioningRun(run: ResourceProvisioningRunRecord, provisioning: JsonRecord) {
    const data = buildFinishProvisioningRunData(run, provisioning);
    return this.repo.updateRun({
      where: { id: run.id },
      data,
    });
  }
}
