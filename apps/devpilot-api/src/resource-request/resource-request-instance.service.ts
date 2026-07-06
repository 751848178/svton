/**
 * Resource-instance lifecycle + audit-log read service.
 *
 * Owns the resource-instance surface (list / get / decrypt-for-generation /
 * release) and the resource-audit-log list query. Instance masking and
 * credential decryption are delegated to the shared status writer. Extracted
 * from `ResourceRequestService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import {
  ListResourceAuditLogsQueryDto,
  ListResourceInstancesQueryDto,
} from './dto/resource-request.dto';

@Injectable()
export class ResourceRequestInstanceService {
  constructor(
    private readonly repo: ResourceRequestRepository,
    private readonly statusWriter: ResourceRequestStatusWriterService,
  ) {}

  async listInstances(teamId: string, query: ListResourceInstancesQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;

    const instances = await this.repo.findInstances({
      where, include: this.statusWriter.instanceInclude(), orderBy: { createdAt: 'desc' },
    });
    return instances.map((instance: Record<string, unknown>) => this.statusWriter.maskInstance(instance));
  }

  async getInstance(teamId: string, id: string) {
    const instance = await this.repo.findInstanceFirst({
      where: { id, teamId },
      include: {
        ...this.statusWriter.instanceInclude(),
        auditLogs: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!instance) throw new NotFoundException('资源实例不存在');
    return this.statusWriter.maskInstance(instance);
  }

  async getInstanceCredentialForGeneration(teamId: string, id: string) {
    const instance = await this.repo.findInstanceFirst({
      where: { id, teamId },
      include: { resourceType: { select: { id: true, key: true, name: true } } },
    });
    if (!instance) throw new NotFoundException('资源实例不存在');
    if (instance.status !== 'active') {
      throw new BadRequestException('只有 active 状态的资源实例可以用于生成项目');
    }

    const delivery = (instance.delivery && typeof instance.delivery === 'object') ? instance.delivery : {};
    const credentials = instance.credentials ? JSON.parse(this.statusWriter.decrypt(instance.credentials)) : {};
    return {
      id: instance.id, type: instance.resourceType.key, name: instance.name,
      config: { ...delivery, ...credentials } as Record<string, unknown>,
    };
  }

  async releaseInstance(teamId: string, userId: string, id: string) {
    const existing = await this.repo.findInstanceFirst({ where: { id, teamId } });
    if (!existing) throw new NotFoundException('资源实例不存在');
    if (existing.status !== 'active') throw new BadRequestException('只有 active 状态的资源实例可以释放');

    const instance = await this.repo.updateInstance({
      where: { id },
      data: { status: 'released', releasedAt: new Date() },
      include: this.statusWriter.instanceInclude(),
    });
    await this.statusWriter.writeAudit({
      teamId, actorId: userId, resourceTypeId: existing.resourceTypeId,
      requestId: existing.requestId, instanceId: id,
      action: 'instance.released', message: '资源实例已释放',
    });
    return this.statusWriter.maskInstance(instance);
  }

  async listAuditLogs(teamId: string, query: ListResourceAuditLogsQueryDto) {
    const where: Record<string, unknown> = { teamId };
    if (query.requestId) where.requestId = query.requestId;
    if (query.instanceId) where.instanceId = query.instanceId;
    if (query.resourceTypeId) where.resourceTypeId = query.resourceTypeId;
    if (query.action) where.action = query.action;
    return this.repo.findResourceAuditLogs({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        resourceType: { select: { id: true, key: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
