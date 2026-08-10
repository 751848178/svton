/**
 * Project-environment CRUD service.
 *
 * Owns the environment lifecycle: `list`, `create`, `update`, `archive`, and
 * `syncFromProject` (ensure defaults then list).
 *
 * F444 hardening (AC-SET-012..016):
 * - `archive`/status→archived are guarded: Staging/Production baselines, envs
 *   with DeploymentRuns/server bindings/environment versions, and the last
 *   active baseline of a role can never be archived; the DB unique constraint
 *   remains the duplicate-role backstop.
 * - display-name/description edits go through `EnvironmentConfigRevisionService
 *   .updateIdentity` (a new immutable revision carries the identity; audited).
 * - key changes and archives are audited in the same transaction as the write.
 * - `syncFromProject` skips defaults seeding for governed projects (baseline
 *   environments are owned by governance finalization, not defaults seeding).
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { ProjectEnvironmentDefaultsService } from './project-environment-defaults.service';
import { EnvironmentConfigRevisionService } from './environment-config-revision.service';
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
    private readonly prisma: PrismaService,
    private readonly revisionService: EnvironmentConfigRevisionService,
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

  async update(teamId: string, actorId: string, id: string, dto: UpdateProjectEnvironmentDto) {
    const existing = await this.get(teamId, id);
    const key = dto.key === undefined ? undefined : normalizeKeyUtil(dto.key);
    if (key !== undefined && key !== existing.key) {
      const deployments = await this.repo.findDeploymentRuns({
        where: { teamId, environmentId: id },
        select: { id: true },
        take: 1,
      });
      if (existing.identityLockedAt || deployments.length > 0) {
        throw new BadRequestException('环境已有部署历史，key 已锁定');
      }
    }

    const keyChanged = key !== undefined && key !== existing.key;
    const archivedViaStatus = dto.status === 'archived' && existing.status !== 'archived';
    if (archivedViaStatus) {
      await this.assertArchiveAllowed(existing);
    }

    const identityChanged =
      (dto.name !== undefined && dto.name !== existing.name) ||
      (dto.description !== undefined &&
        (dto.description ?? null) !== (existing.description ?? null));
    if (identityChanged) {
      await this.revisionService.updateIdentity(teamId, actorId, id, {
        name: dto.name,
        description: dto.description,
        reason: dto.reason,
      });
    }

    const rowData: Prisma.ProjectEnvironmentUpdateInput = {};
    if (keyChanged) rowData.key = key;
    if (dto.status !== undefined && dto.status !== existing.status) rowData.status = dto.status;
    if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
      rowData.sortOrder = dto.sortOrder;
    }

    if (Object.keys(rowData).length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.projectEnvironment.update({
          where: { id: existing.id },
          data: rowData,
        });
        if (keyChanged) {
          await tx.auditEvent.create({
            data: {
              teamId,
              actorId: actorId ?? null,
              projectId: existing.projectId,
              environmentId: id,
              category: 'project_environment',
              action: 'project_environment.key.update',
              targetType: 'project_environment',
              targetId: id,
              risk: 'medium',
              status: 'completed',
              summary: `更换环境 key：${existing.key} -> ${key}`,
              metadata: { previousKey: existing.key, key } as Prisma.InputJsonValue,
            },
          });
        }
        if (archivedViaStatus) {
          await tx.auditEvent.create({
            data: {
              teamId,
              actorId: actorId ?? null,
              projectId: existing.projectId,
              environmentId: id,
              category: 'project_environment',
              action: 'project_environment.archive',
              targetType: 'project_environment',
              targetId: id,
              risk: 'high',
              status: 'completed',
              summary: `归档环境 ${existing.name} (${existing.key})`,
              metadata: {
                key: existing.key,
                baselineRole: existing.baselineRole ?? null,
              } as Prisma.InputJsonValue,
            },
          });
        }
      });
    }

    return this.refresh(existing.id, teamId);
  }

  async archive(teamId: string, actorId: string, id: string) {
    const existing = await this.get(teamId, id);
    await this.assertArchiveAllowed(existing);
    await this.prisma.$transaction(async (tx) => {
      await tx.projectEnvironment.update({
        where: { id },
        data: { status: 'archived' },
      });
      await tx.auditEvent.create({
        data: {
          teamId,
          actorId: actorId ?? null,
          projectId: existing.projectId,
          environmentId: id,
          category: 'project_environment',
          action: 'project_environment.archive',
          targetType: 'project_environment',
          targetId: id,
          risk: 'high',
          status: 'completed',
          summary: `归档环境 ${existing.name} (${existing.key})`,
          metadata: {
            key: existing.key,
            baselineRole: existing.baselineRole ?? null,
          } as Prisma.InputJsonValue,
        },
      });
    });
    return this.refresh(existing.id, teamId);
  }

  async syncFromProject(teamId: string, projectId: string) {
    const project = await this.assertProject(teamId, projectId);
    const governed = await this.hasActiveBaselines(teamId, projectId);
    if (!governed) {
      await this.defaultsService.ensureDefaultsForProject(teamId, project.id, project.config);
    }
    return this.list(teamId, { projectId });
  }

  private async refresh(id: string, teamId: string) {
    const environment = await this.repo.findProjectEnvironment({
      where: { id, teamId },
      include: { project: { select: { id: true, name: true } } },
    });
    if (!environment) throw new NotFoundException('项目环境不存在');
    return environment;
  }

  /**
   * AC-SET-012 archive guard. Mirrors the demo rule: baseline environments are
   * governance-mandated, environments with runs/bindings/versions must not be
   * archived directly, and the last active baseline of a role cannot go away.
   * The DB unique constraint stays the duplicate-role backstop.
   */
  private async assertArchiveAllowed(existing: {
    id: string;
    teamId: string;
    projectId: string;
    key: string;
    baselineRole: string | null;
  }) {
    if (existing.baselineRole === 'staging' || existing.baselineRole === 'production') {
      throw new BadRequestException(
        `基线环境不允许归档：${existing.baselineRole === 'staging' ? 'Staging' : 'Production'} 是治理必需环境`,
      );
    }
    const [deployments, bindings, versions] = await Promise.all([
      this.repo.findDeploymentRuns({
        where: { teamId: existing.teamId, environmentId: existing.id },
        select: { id: true },
        take: 1,
      }),
      this.repo.findProjectEnvironmentServers({
        where: { environmentId: existing.id },
        select: { id: true },
        take: 1,
      }),
      this.prisma.environmentVersion.findFirst({
        where: { teamId: existing.teamId, environmentId: existing.id },
        select: { id: true },
      }),
    ]);
    if (deployments.length > 0 || bindings.length > 0 || versions) {
      throw new BadRequestException(
        '环境存在运行或绑定记录，禁止直接归档：请先处理关联的部署运行、服务器绑定与环境版本',
      );
    }
    if (existing.baselineRole) {
      const remaining = await this.prisma.projectEnvironment.count({
        where: {
          projectId: existing.projectId,
          baselineRole: existing.baselineRole,
          status: 'active',
          id: { not: existing.id },
        },
      });
      if (remaining === 0) {
        throw new BadRequestException('该环境是该角色的最后一个活动环境，禁止归档');
      }
    }
  }

  private async hasActiveBaselines(teamId: string, projectId: string) {
    const rows = await this.prisma.projectEnvironment.findMany({
      where: {
        teamId,
        projectId,
        status: 'active',
        baselineRole: { in: ['staging', 'production'] },
      },
      select: { baselineRole: true },
    });
    const roles = new Set(rows.map((row) => row.baselineRole));
    return roles.has('staging') && roles.has('production');
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
