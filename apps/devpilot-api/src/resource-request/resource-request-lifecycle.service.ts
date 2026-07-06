/**
 * Resource-request lifecycle service (request-side).
 *
 * Owns the request write surface: create / list / get / review (approve /
 * reject) / complete (manual delivery) / retry / cancel. The provisioned
 * completion, audit, and instance encryption are delegated to the shared
 * status writer; provisioning dispatch goes through the provisioning
 * orchestrator. Instance lifecycle lives in `ResourceRequestInstanceService`.
 * Extracted from `ResourceRequestService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceRequestAccessService } from './resource-request-access.service';
import { ResourceRequestProvisioningService } from './resource-request-provisioning.service';
import {
  CompleteResourceRequestDto,
  CreateResourceRequestDto,
  ListResourceRequestsQueryDto,
  ReviewResourceRequestDto,
} from './dto/resource-request.dto';
import { asRecord } from './resource-provisioning-value.utils';
import { normalizeProvisioningMode } from './resource-provisioning-script.utils';

@Injectable()
export class ResourceRequestLifecycleService {
  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly accessService: ResourceRequestAccessService,
    private readonly provisioning: ResourceRequestProvisioningService,
  ) {}

  async createRequest(teamId: string, userId: string, dto: CreateResourceRequestDto) {
    const resourceType = await this.accessService.ensureResourceType(dto.resourceTypeId);
    const environmentRef = await this.accessService.resolveProjectEnvironment(teamId, dto.environmentId, dto.projectId);
    const projectId = environmentRef?.projectId ?? dto.projectId;
    await this.accessService.ensureProject(teamId, projectId);

    const request = await this.repo.createRequest({
      data: {
        teamId, projectId, environmentId: environmentRef?.id, resourceTypeId: dto.resourceTypeId,
        requesterId: userId, title: dto.title, environment: dto.environment || environmentRef?.key,
        purpose: dto.purpose, spec: dto.spec,
        status: resourceType.approvalMode === 'none' ? 'approved' : 'pending',
        reviewedAt: resourceType.approvalMode === 'none' ? new Date() : null,
      },
      include: this.statusWriter.requestInclude(),
    });

    await this.statusWriter.writeAudit({
      teamId, actorId: userId, resourceTypeId: dto.resourceTypeId, requestId: request.id,
      action: 'request.created', message: '创建资源申请', metadata: { approvalMode: resourceType.approvalMode },
    });

    if (request.status === 'approved') {
      return this.provisioning.runApprovedProvisioningProcessor(teamId, userId, request, { trigger: 'approval' });
    }
    return request;
  }

  async listRequests(teamId: string, query: ListResourceRequestsQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;
    if (query.requesterId) where.requesterId = query.requesterId;
    return this.repo.findRequests({
      where, include: this.statusWriter.requestInclude(), orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(teamId: string, id: string) {
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

  async reviewRequest(teamId: string, userId: string, id: string, dto: ReviewResourceRequestDto) {
    const existing = await this.getRequest(teamId, id);
    if (existing.status !== 'pending') throw new BadRequestException('只有待审批的申请可以审批');

    const request = await this.repo.updateRequest({
      where: { id },
      data: { status: dto.status, reviewerId: userId, reviewedAt: new Date(), approvalComment: dto.comment },
      include: this.statusWriter.requestInclude(),
    });
    await this.statusWriter.writeAudit({
      teamId, actorId: userId, resourceTypeId: existing.resourceTypeId as string, requestId: existing.id as string,
      action: dto.status === 'approved' ? 'request.approved' : 'request.rejected', message: dto.comment,
    });
    if (dto.status === 'approved') {
      return this.provisioning.runApprovedProvisioningProcessor(teamId, userId, request, { trigger: 'approval' });
    }
    return request;
  }

  async completeRequest(teamId: string, userId: string, id: string, dto: CompleteResourceRequestDto) {
    const existing = await this.getRequest(teamId, id);
    if (!['approved', 'pending'].includes(existing.status)) {
      throw new BadRequestException('当前申请状态不能交付');
    }
    const mode = normalizeProvisioningMode(existing.resourceType?.provisioningMode);
    return this.statusWriter.completeProvisionedRequest(teamId, userId, existing, {
      createInstance: dto.createInstance !== false,
      instanceName: dto.instanceName || existing.title,
      config: asRecord(dto.config),
      delivery: asRecord(dto.delivery),
      credentials: asRecord(dto.credentials),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      provisioning: { mode, status: 'completed', boundary: 'manual_delivery', completedAt: new Date().toISOString() },
      auditMetadata: { createInstance: dto.createInstance !== false, provisioningMode: mode, boundary: 'manual_delivery' },
    });
  }

  async retryProvisioning(teamId: string, userId: string, id: string) {
    const existing = await this.getRequest(teamId, id);
    return this.provisioning.retryProvisioningRecord(teamId, userId, existing, { trigger: 'manual_retry' });
  }

  async cancelRequest(teamId: string, userId: string, id: string) {
    const existing = await this.getRequest(teamId, id);
    if (existing.status === 'completed') throw new BadRequestException('已完成的申请不能取消');

    const request = await this.repo.updateRequest({
      where: { id },
      data: { status: 'canceled', canceledAt: new Date() },
      include: this.statusWriter.requestInclude(),
    });
    await this.statusWriter.writeAudit({
      teamId, actorId: userId, resourceTypeId: existing.resourceTypeId, requestId: id,
      action: 'request.canceled', message: '资源申请已取消',
    });
    return request;
  }
}
