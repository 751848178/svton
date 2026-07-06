/**
 * Resource-request access-scope resolution service.
 *
 * Owns the project / environment / resource-type guards and the request /
 * instance access-scope resolution used by the controller's row-level access
 * policy checks and by request creation. Extracted from `ResourceRequestService`
 * so the facade and lifecycle service stop carrying these guards inline.
 * Behavior preserved verbatim — identical repository calls and error messages.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { CreateResourceRequestDto } from './dto/resource-request.dto';

@Injectable()
export class ResourceRequestAccessService {
  constructor(private readonly repo: ResourceRequestRepository) {}

  async ensureProject(teamId: string, projectId?: string) {
    if (!projectId) return null;

    const project = await this.repo.findProject({
      where: { id: projectId, teamId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  async resolveProjectEnvironment(
    teamId: string,
    environmentId?: string,
    projectId?: string,
  ) {
    if (!environmentId) return null;

    const environment = await this.repo.findProjectEnvironment({
      where: { id: environmentId, teamId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true },
    });

    if (!environment) {
      throw new NotFoundException('项目环境不存在或已归档');
    }

    if (projectId && environment.projectId !== projectId) {
      throw new BadRequestException('项目环境不属于所选项目');
    }

    return environment;
  }

  async ensureResourceType(resourceTypeId: string) {
    const resourceType = await this.repo.findResourceTypeFirst({
      where: { id: resourceTypeId, enabled: true },
    });

    if (!resourceType) {
      throw new NotFoundException('资源类型不存在或已停用');
    }

    return resourceType;
  }

  async resolveRequestInputAccessScope(teamId: string, dto: CreateResourceRequestDto) {
    const environmentRef = await this.resolveProjectEnvironment(teamId, dto.environmentId, dto.projectId);
    const projectId = environmentRef?.projectId ?? dto.projectId ?? null;
    await this.ensureProject(teamId, projectId || undefined);
    return {
      projectId,
      environmentId: environmentRef?.id ?? null,
    };
  }

  async getRequestAccessScope(teamId: string, id: string) {
    const request = await this.repo.findRequestFirst({
      where: { id, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!request) {
      throw new NotFoundException('资源申请不存在');
    }

    return {
      projectId: request.projectId,
      environmentId: request.environmentId,
    };
  }

  async getInstanceAccessScope(teamId: string, id: string) {
    const instance = await this.repo.findInstanceFirst({
      where: { id, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!instance) {
      throw new NotFoundException('资源实例不存在');
    }

    return {
      projectId: instance.projectId,
      environmentId: instance.environmentId,
    };
  }
}
