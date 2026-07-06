/**
 * Provider-state reconciliation + polling orchestrator.
 *
 * Owns the public provider SDK provisioning-state surface: manual providerState
 * reconciliation (`reconcileProviderProvisioningRun`) and the background polling
 * scanner (`processDueProviderStatePollingRuns`). The reconcile applier and the
 * four polling-state writers live in `ResourceProviderStateWriterService` so
 * each file stays under the 200-line ceiling. Extracted from
 * `ResourceRequestService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceRequestProvisioningService } from './resource-request-provisioning.service';
import { ResourceProviderStateWriterService } from './resource-provider-state-writer.service';
import { ReconcileProviderResourceProvisioningRunDto } from './dto/resource-request.dto';
import {
  JsonRecord,
  ProviderStatePollingConfig,
  ProviderStatePollingSummary,
  ProvisioningResourceType,
  ResourceProvisioningRunRecord,
} from './resource-request.types';
import {
  asRecord,
  errorMessage,
  hasRecordValues,
  readNonNegativeInteger,
  readString,
} from './resource-provisioning-value.utils';
import { redactSensitiveRecord } from './resource-provisioning-sensitive.utils';
import {
  buildProviderStatePollingMetadata,
  readProviderStatePollingConfig,
  readProviderStatePollingState,
} from './resource-provisioning-provider-config.utils';
import { readProviderStateStatus } from './resource-provisioning-provider-state.utils';

@Injectable()
export class ResourceProviderStateService {
  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly provisioning: ResourceRequestProvisioningService,
    private readonly writer: ResourceProviderStateWriterService,
  ) {}

  async reconcileProviderProvisioningRun(
    teamId: string,
    userId: string | undefined,
    requestId: string,
    runId: string,
    dto: ReconcileProviderResourceProvisioningRunDto,
  ) {
    const existing = await this.getRequestOrFail(teamId, requestId);
    const run = await this.repo.findRunFirst({ where: { id: runId, teamId, requestId } });
    if (!run) throw new NotFoundException('资源交付运行不存在');
    if (readString(run.mode) !== 'provider') {
      throw new BadRequestException('只有 provider SDK 交付运行可以对账 providerState');
    }
    if (existing.status !== 'approved') {
      throw new BadRequestException('只有已审批且未交付的 provider 申请可以对账');
    }
    const currentProvisioning = asRecord(asRecord(existing.result).provisioning);
    if (readString(currentProvisioning.provisioningRunId) !== run.id) {
      throw new BadRequestException('只能对账当前资源申请正在指向的 provider 交付运行');
    }
    const runStatus = readString(run.status);
    if (!['planned', 'blocked', 'failed', 'running'].includes(runStatus)) {
      throw new BadRequestException('只有已生成计划、已阻断、失败或运行中的 provider 交付运行可以对账');
    }
    const providerState = asRecord(dto.providerState);
    if (!hasRecordValues(providerState)) throw new BadRequestException('providerState 不能为空');

    const resourceType = await this.provisioning.getProvisioningResourceType(existing.resourceTypeId as string);
    return this.writer.applyProviderStateReconcile({
      teamId, userId, existing, run: run as ResourceProvisioningRunRecord, runStatus,
      resourceType, providerState, dto,
    });
  }

  async processDueProviderStatePollingRuns(
    options: { limit?: number; now?: Date } = {},
  ): Promise<ProviderStatePollingSummary> {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const now = options.now ?? new Date();
    const lockOwner = 'resource-request-provider-state-poller';
    const runs = await this.repo.findRuns({
      where: { mode: 'provider', status: 'planned',
        OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
      orderBy: [{ availableAt: 'asc' }, { startedAt: 'asc' }],
      take: Math.min(limit * 5, 250),
      include: {
        request: { include: this.statusWriter.requestInclude() },
        resourceType: { select: { id: true, key: true, name: true, provisioningMode: true, provisioningConfig: true, deliverySchema: true } },
      },
    });
    const summary: ProviderStatePollingSummary = {
      scanned: runs.length, polled: 0, completed: 0, planned: 0, blocked: 0, skipped: 0, failed: 0,
    };

    for (const run of runs) {
      if (summary.polled >= limit) break;
      const request = asRecord(run.request);
      const currentProvisioning = asRecord(asRecord(request.result).provisioning);
      if (request.status !== 'approved' || readString(currentProvisioning.provisioningRunId) !== run.id) {
        summary.skipped += 1; continue;
      }
      const resourceType = asRecord(run.resourceType) as unknown as ProvisioningResourceType;
      const pollingConfig = readProviderStatePollingConfig(asRecord(resourceType.provisioningConfig));
      if (!pollingConfig.enabled) { summary.skipped += 1; continue; }

      const attempt = (readNonNegativeInteger(run.attempt) ?? 0) + 1;
      const nextAvailableAt = new Date(now.getTime() + pollingConfig.intervalSeconds * 1000);
      const claim = await this.repo.updateRuns({
        where: { id: run.id, mode: 'provider', status: 'planned',
          OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
        data: { status: 'running', attempt, lockedAt: now, lockOwner },
      });
      if (claim.count !== 1) { summary.skipped += 1; continue; }

      summary.polled += 1;
      const claimedRun = { ...run, status: 'running', attempt, lockedAt: now, lockOwner } as ResourceProvisioningRunRecord;
      try {
        await this.pollProviderRun({ claimedRun, request, currentProvisioning, resourceType, pollingConfig, attempt, now, nextAvailableAt, summary });
      } catch (error) {
        summary.failed += 1;
        await this.writer.markProviderStatePollingError(claimedRun, request, currentProvisioning, pollingConfig, attempt, now, nextAvailableAt, errorMessage(error));
      }
    }
    return summary;
  }

  private async pollProviderRun(input: {
    claimedRun: ResourceProvisioningRunRecord; request: JsonRecord; currentProvisioning: JsonRecord;
    resourceType: ProvisioningResourceType; pollingConfig: ProviderStatePollingConfig;
    attempt: number; now: Date; nextAvailableAt: Date; summary: ProviderStatePollingSummary;
  }) {
    const { claimedRun, request, currentProvisioning, resourceType, pollingConfig, attempt, now, nextAvailableAt, summary } = input;
    if (attempt > pollingConfig.maxAttempts) {
      await this.writer.blockProviderStatePollingRun(claimedRun, request, currentProvisioning, pollingConfig, attempt, now, 'provider_state_polling_max_attempts_exceeded');
      summary.blocked += 1; return;
    }
    const polledState = readProviderStatePollingState(asRecord(resourceType.provisioningConfig), attempt);
    if (!hasRecordValues(polledState.providerState)) {
      await this.writer.markProviderStatePollingPending(claimedRun, request, currentProvisioning, pollingConfig, attempt, now, nextAvailableAt, 'provider_state_poll_no_state', polledState.source);
      summary.planned += 1; return;
    }
    await this.statusWriter.writeAudit({
      teamId: claimedRun.teamId as string, resourceTypeId: claimedRun.resourceTypeId as string,
      requestId: claimedRun.requestId as string, provisioningRunId: claimedRun.id as string,
      action: 'provisioning.provider_state_polled', message: '自动轮询 provider SDK 交付状态',
      metadata: {
        providerPolling: buildProviderStatePollingMetadata(pollingConfig, attempt, now, nextAvailableAt,
          { source: polledState.source, stateFound: true,
            providerStateStatus: readProviderStateStatus(polledState.providerState) || undefined }),
        providerState: redactSensitiveRecord(polledState.providerState),
      },
    });
    const updated = await this.reconcileProviderProvisioningRun(claimedRun.teamId as string, undefined,
      request.id as string, claimedRun.id as string,
      { providerState: polledState.providerState, createInstance: pollingConfig.createInstance, instanceName: pollingConfig.instanceName });
    const resultProvisioning = asRecord(asRecord(updated.result).provisioning);
    const status = readString(resultProvisioning.status);
    if (status === 'completed') summary.completed += 1;
    else if (status === 'blocked') summary.blocked += 1;
    else {
      await this.writer.updateProviderStatePollingMetadata(claimedRun, resultProvisioning, pollingConfig, attempt, now, nextAvailableAt, polledState.source);
      summary.planned += 1;
    }
  }

  private async getRequestOrFail(teamId: string, id: string) {
    const request = await this.repo.findRequestFirst({
      where: { id, teamId },
      include: { ...this.statusWriter.requestInclude(),
        auditLogs: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, name: true, email: true } } } } },
    });
    if (!request) throw new NotFoundException('资源申请不存在');
    return request;
  }
}
