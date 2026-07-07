/**
 * Project-environment CRUD service.
 *
 * Owns the environment lifecycle: `list`, `create`, `update`, `archive`, and
 * `syncFromProject` (ensure defaults then list). Extracted from
 * `ProjectEnvironmentService`. Behavior preserved verbatim.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { ProjectEnvironmentDefaultsService } from './project-environment-defaults.service';
import {
  CreateProjectEnvironmentDto,
  ListProjectEnvironmentsQueryDto,
  UpdateProjectEnvironmentDto,
} from './dto/project-environment.dto';
import {
  labelForKey as labelForKeyUtil,
  normalizeKey as normalizeKeyUtil,
  sortOrderForKey as sortOrderForKeyUtil,
  toJsonValue as toJsonValueUtil,
} from './project-environment-helpers.utils';

@Injectable()
export class ProjectEnvironmentCrudService {
  constructor(
    private readonly repo: ProjectEnvironmentRepository,
    private readonly defaultsService: ProjectEnvironmentDefaultsService,
  ) {}

  async list(teamId: string, query: ListProjectEnvironmentsQueryDto) {
    const where: Prisma.ProjectEnvironmentWhereInput = { teamId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;

    return this.repo.findProjectEnvironments({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async create(teamId: string, dto: CreateProjectEnvironmentDto) {
    await this.assertProject(teamId, dto.projectId);
    const key = normalizeKeyUtil(dto.key);

    return this.repo.createProjectEnvironment({
      data: {
        teamId,
        projectId: dto.projectId,
        key,
        name: dto.name || labelForKeyUtil(key),
        description: dto.description,
        sortOrder: dto.sortOrder ?? sortOrderForKeyUtil(key),
        config: dto.config ? toJsonValueUtil(dto.config) : undefined,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async update(teamId: string, id: string, dto: UpdateProjectEnvironmentDto) {
    const existing = await this.get(teamId, id);
    const key = dto.key === undefined ? undefined : normalizeKeyUtil(dto.key);

    return this.repo.updateProjectEnvironment({
      where: { id: existing.id },
      data: {
        key,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        sortOrder: dto.sortOrder,
        config: dto.config !== undefined ? toJsonValueUtil(dto.config) : undefined,
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async archive(teamId: string, id: string) {
    await this.get(teamId, id);
    return this.repo.updateProjectEnvironment({ where: { id }, data: { status: 'archived' } });
  }

  async syncFromProject(teamId: string, projectId: string) {
    const project = await this.assertProject(teamId, projectId);
    await this.defaultsService.ensureDefaultsForProject(teamId, project.id, project.config);
    return this.list(teamId, { projectId });
  }

  private async get(teamId: string, id: string) {
    const environment = await this.repo.findProjectEnvironment({ where: { id, teamId } });
    if (!environment) throw new NotFoundException('项目环境不存在');
    return environment;
  }

  private async assertProject(teamId: string, projectId: string) {
    const project = await this.repo.findProject({ where: { id: projectId, teamId }, select: { id: true, config: true } });
    if (!project) throw new NotFoundException('项目不存在或不属于当前团队');
    return project;
  }
}
