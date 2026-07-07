/**
 * Project-environment server-binding service.
 *
 * Owns the per-environment server role binding lifecycle: `listServers`,
 * `getAccessScope`, `bindServer`, `unbindServer`. Each mutating action writes
 * an audit event. Extracted from `ProjectEnvironmentService`. Behavior
 * preserved verbatim.
 */

import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AuditEventService } from '../audit-event';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { BindProjectEnvironmentServerDto } from './dto/project-environment.dto';
import { buildServerBindingAuditInput } from './project-environment-audit.utils';
import { toJsonValue as toJsonValueUtil } from './project-environment-helpers.utils';

@Injectable()
export class ProjectEnvironmentServerBindingService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
    @Optional() private readonly auditEventService: AuditEventService | null,
  ) {}

  async listServers(teamId: string, environmentId: string) {
    const environment = await this.get(teamId, environmentId);
    return (this.repo.findProjectEnvironmentServers({
      where: { teamId, environmentId: environment.id, status: 'active' },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        server: { select: { id: true, name: true, host: true, status: true, services: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
      },
    }) as any);
  }

  async getAccessScope(teamId: string, environmentId: string) {
    const environment = await this.get(teamId, environmentId);
    return { projectId: environment.projectId, environmentId: environment.id };
  }

  async bindServer(teamId: string, userId: string, environmentId: string, dto: BindProjectEnvironmentServerDto) {
    const environment = await this.get(teamId, environmentId);
    await this.assertServer(teamId, dto.serverId);

    const binding = await this.repo.upsertProjectEnvironmentServer({
      where: { environmentId_serverId: { environmentId: environment.id, serverId: dto.serverId } },
      create: {
        teamId, projectId: environment.projectId, environmentId: environment.id, serverId: dto.serverId,
        role: dto.role || null, metadata: dto.metadata ? toJsonValueUtil(dto.metadata) : undefined,
      },
      update: {
        projectId: environment.projectId, role: dto.role || null, status: 'active',
        metadata: dto.metadata ? toJsonValueUtil(dto.metadata) : undefined,
      },
      include: {
        server: { select: { id: true, name: true, host: true, status: true, services: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
      },
    });

    await this.auditEventService?.create(buildServerBindingAuditInput(teamId, userId, {
      projectId: environment.projectId, environmentId: environment.id, environmentName: environment.name,
      serverId: dto.serverId, serverName: binding.server.name, role: dto.role || null,
      action: 'bind', status: 'completed',
    }) as any);

    return binding;
  }

  async unbindServer(teamId: string, userId: string, environmentId: string, serverId: string) {
    const environment = await this.get(teamId, environmentId);
    const binding = await this.repo.findProjectEnvironmentServer({
      where: { teamId, environmentId: environment.id, serverId },
      select: { id: true, role: true, server: { select: { id: true, name: true } } },
    });

    if (!binding) throw new NotFoundException('环境服务器绑定不存在');

    await this.repo.deleteProjectEnvironmentServer({ where: { id: binding.id } });
    await this.auditEventService?.create(buildServerBindingAuditInput(teamId, userId, {
      projectId: environment.projectId, environmentId: environment.id, environmentName: environment.name,
      serverId, serverName: binding.server.name, role: binding.role,
      action: 'unbind', status: 'completed',
    }) as any);

    return { success: true };
  }

  private async get(teamId: string, id: string) {
    const environment = await this.repo.findProjectEnvironment({ where: { id, teamId } });
    if (!environment) throw new NotFoundException('项目环境不存在');
    return environment;
  }

  private async assertServer(teamId: string, serverId: string) {
    const server = await this.repo.findServer({ where: { id: serverId, teamId }, select: { id: true } });
    if (!server) throw new NotFoundException('服务器不存在或不属于当前团队');
    return server;
  }
}
