/**
 * Resource-binding service.
 *
 * Owns the managed-resource binding update flow (`updateResourceBinding`):
 * resolving project / environment / server / credential targets, validating
 * consistency, binding the server to the environment, persisting the new
 * binding, and writing the binding audit event. Includes the binding-snapshot
 * builder and the query-credential-id merge helper. Extracted from
 * `ResourceControlService`. Behavior preserved verbatim.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { ResourceControlRepository } from './resource-control.repository';
import { managedResourceInclude } from './resource-control-includes.constants';
import { UpdateManagedResourceBindingDto } from './dto/resource-control.dto';
import { asRecord } from './resource-control-value.utils';
import { toJsonValue } from './resource-control-query-type.utils';
import {
  buildResourceBindingSnapshot,
  mergeQueryCredentialBinding,
  resolveQueryCredentialId,
} from './resource-control-binding.utils';

type EnvironmentRef = { id: string; projectId: string; key: string; name: string };

@Injectable()
export class ResourceControlBindingService {
  constructor(
    private readonly repo: ResourceControlRepository,
    private readonly auditEventService: AuditEventService,
  ) {}

  async updateResourceBinding(
    teamId: string, userId: string, resourceId: string, dto: UpdateManagedResourceBindingDto,
  ) {
    const resource = await this.getManagedResource(teamId, resourceId);
    const hasProject = Object.prototype.hasOwnProperty.call(dto, 'projectId');
    const hasEnvironment = Object.prototype.hasOwnProperty.call(dto, 'environmentId');
    const hasServer = Object.prototype.hasOwnProperty.call(dto, 'serverId');
    const hasCredential = Object.prototype.hasOwnProperty.call(dto, 'credentialId');
    const hasQueryCredential = Object.prototype.hasOwnProperty.call(dto, 'queryCredentialId');
    const before = buildResourceBindingSnapshot(resource);

    let nextProjectId = resource.projectId;
    let nextEnvironmentId = resource.environmentId;

    if (hasEnvironment) {
      if (dto.environmentId) {
        const environment = await this.resolveProjectEnvironment(teamId, dto.environmentId);
        if (!environment) throw new NotFoundException('项目环境不存在或已归档');
        if (hasProject && dto.projectId && dto.projectId !== environment.projectId) {
          throw new BadRequestException('项目环境不属于指定项目');
        }
        if (hasProject && dto.projectId === null) {
          throw new BadRequestException('绑定环境时不能清空项目');
        }
        nextEnvironmentId = environment.id;
        nextProjectId = environment.projectId;
      } else {
        nextEnvironmentId = null;
        nextProjectId = hasProject ? (dto.projectId ?? null) : null;
      }
    } else if (hasProject) {
      if (resource.environmentId && dto.projectId !== resource.projectId) {
        throw new BadRequestException('资源已绑定环境，调整项目时需要同步改选或清空环境');
      }
      nextProjectId = dto.projectId ?? null;
    }

    if (nextProjectId) await this.ensureProject(teamId, nextProjectId);

    const nextServerId = hasServer ? (dto.serverId ?? null) : resource.serverId;
    if (resource.sourceType === 'server' && !nextServerId) {
      throw new BadRequestException('服务器来源资源必须绑定服务器');
    }
    if (nextServerId) await this.ensureServer(teamId, nextServerId);

    const nextCredentialId = hasCredential ? (dto.credentialId ?? null) : resource.credentialId;
    if (nextCredentialId) await this.ensureTeamCredential(teamId, nextCredentialId);

    const nextQueryCredentialId = hasQueryCredential
      ? (dto.queryCredentialId ?? null)
      : (resolveQueryCredentialId(resource) ?? null);
    if (nextQueryCredentialId) await this.ensureTeamCredential(teamId, nextQueryCredentialId);

    if (nextEnvironmentId && nextServerId) {
      const environment = await this.resolveProjectEnvironment(teamId, nextEnvironmentId);
      if (!environment) throw new NotFoundException('项目环境不存在或已归档');
      await this.bindServerToEnvironment(teamId, environment, nextServerId, {
        source: 'resource-control.updateResourceBinding', managedResourceId: resource.id,
      });
    }

    const updated = await this.repo.updateManagedResource({
      where: { id: resource.id },
      data: {
        projectId: nextProjectId, environmentId: nextEnvironmentId, serverId: nextServerId,
        credentialId: nextCredentialId,
        config: hasQueryCredential
          ? toJsonValue(mergeQueryCredentialBinding(resource.config, nextQueryCredentialId))
          : undefined,
      },
      include: managedResourceInclude,
    });

    await this.writeResourceBindingAudit(teamId, userId, resource, updated, before, dto.reason);
    return updated;
  }

  async getManagedResource(teamId: string, resourceId: string) {
    const resource = await this.repo.findManagedResource({
      where: { id: resourceId, teamId }, include: managedResourceInclude,
    });
    if (!resource) throw new NotFoundException('托管资源不存在');
    return resource;
  }

  async resolveProjectEnvironment(teamId: string, environmentId?: string): Promise<EnvironmentRef | null> {
    if (!environmentId) return null;
    const environment = await this.repo.findProjectEnvironment({
      where: { id: environmentId, teamId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true },
    });
    if (!environment) throw new NotFoundException('项目环境不存在或已归档');
    return environment;
  }

  async ensureProject(teamId: string, projectId: string) {
    const project = await this.repo.findProject({ where: { id: projectId, teamId }, select: { id: true } });
    if (!project) throw new NotFoundException('项目不存在或不属于当前团队');
    return project;
  }

  async ensureServer(teamId: string, serverId: string) {
    const server = await this.repo.findServer({ where: { id: serverId, teamId }, select: { id: true } });
    if (!server) throw new NotFoundException('服务器不存在或不属于当前团队');
    return server;
  }

  async ensureTeamCredential(teamId: string, credentialId: string) {
    const credential = await this.repo.findTeamCredential({ where: { id: credentialId, teamId }, select: { id: true } });
    if (!credential) throw new NotFoundException('团队凭证不存在或不属于当前团队');
    return credential;
  }

  async bindServerToEnvironment(
    teamId: string, environment: EnvironmentRef, serverId: string, metadata: Record<string, unknown>,
  ) {
    await this.repo.upsertProjectEnvironmentServer({
      where: { environmentId_serverId: { environmentId: environment.id, serverId } },
      create: {
        teamId, projectId: environment.projectId, environmentId: environment.id, serverId,
        role: 'runtime', metadata: toJsonValue(metadata),
      },
      update: { projectId: environment.projectId, status: 'active', role: 'runtime', metadata: toJsonValue(metadata) },
    });
  }

  private async writeResourceBindingAudit(
    teamId: string, userId: string,
    previousResource: { id: string; name: string; sourceType: string; provider: string; kind: string; endpoint: string | null },
    updatedResource: {
      id: string; name: string; projectId: string | null; environmentId: string | null; serverId: string | null;
      credentialId: string | null; sourceType: string; provider: string; kind: string; endpoint: string | null;
      config: Prisma.JsonValue | null;
      project?: { id: string; name: string } | null;
      environment?: { id: string; key: string; name: string; status: string } | null;
      server?: { id: string; name: string; host: string; status: string } | null;
      credential?: { id: string; name: string; type: string } | null;
    },
    before: Record<string, unknown>, reason?: string,
  ) {
    await this.auditEventService.create({
      teamId, actorId: userId, projectId: updatedResource.projectId, environmentId: updatedResource.environmentId,
      serverId: updatedResource.serverId, managedResourceId: updatedResource.id,
      category: 'resource_binding', action: 'resource.binding.update',
      targetType: 'managed_resource', targetId: updatedResource.id,
      risk: 'low', status: 'completed', summary: `资源绑定更新 ${updatedResource.name}`,
      metadata: {
        resourceName: updatedResource.name, sourceType: updatedResource.sourceType,
        provider: updatedResource.provider, kind: updatedResource.kind, endpoint: updatedResource.endpoint,
        before, after: buildResourceBindingSnapshot(updatedResource), reason,
        previousResource: {
          id: previousResource.id, name: previousResource.name, sourceType: previousResource.sourceType,
          provider: previousResource.provider, kind: previousResource.kind, endpoint: previousResource.endpoint,
        },
      },
    });
  }
}
