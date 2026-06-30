import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectEnvironmentService } from '../project-environment';
import { CreateProjectDto, ProjectOrigin, UpdateProjectDto } from './dto/project.dto';

type ProjectConfigInput = {
  name?: string;
  description?: string;
  config?: object;
  origin?: ProjectOrigin;
};

type GeneratedProjectArtifactInput = {
  kind: 'project_zip';
  storage: 'local';
  fileName: string;
  size: number;
  sha256: string;
  generatedAt: string;
  downloadUrl: string;
  retentionDays: number;
  expiresAt: string;
  lastDownloadedAt?: string;
  lastDownloadedBy?: string;
  downloadCount?: number;
};

const DEFAULT_PROJECT_ENVIRONMENT_KEYS = ['dev', 'test', 'staging', 'prod'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readOrigin(value: unknown): ProjectOrigin | undefined {
  if (value === 'generated' || value === 'imported' || value === 'external') {
    return value;
  }

  return undefined;
}

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectEnvironmentService: ProjectEnvironmentService,
  ) {}

  async create(teamId: string, userId: string, dto: CreateProjectDto) {
    const config = this.normalizeProjectConfig(dto);

    const project = await this.prisma.project.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        description: dto.description,
        config,
        gitRepo: dto.gitRepo,
      },
    });

    await this.projectEnvironmentService.ensureDefaultsForProject(teamId, project.id, config);

    this.logger.log(`Project created: ${project.id} (${dto.name})`);

    return project;
  }

  async findAll(teamId: string) {
    const projects = await this.prisma.project.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            allocations: true,
            environments: true,
            applications: true,
            applicationServices: true,
            proxyConfigs: true,
            sites: true,
            cdnConfigs: true,
            secretKeys: true,
          },
        },
      },
    });

    return projects;
  }

  async findOne(teamId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, teamId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        allocations: {
          select: {
            id: true,
            resourceName: true,
            status: true,
            createdAt: true,
            releasedAt: true,
            pool: {
              select: { id: true, name: true, type: true },
            },
          },
        },
        environments: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            _count: {
              select: {
                serverBindings: true,
                sites: true,
                deploymentRuns: true,
                managedResources: true,
                resourceRequests: true,
                resourceInstances: true,
                cdnConfigs: true,
                secretKeys: true,
              },
            },
            serverBindings: {
              where: { status: 'active' },
              take: 3,
              include: {
                server: { select: { id: true, name: true, host: true, status: true } },
              },
            },
          },
        },
        proxyConfigs: true,
        sites: {
          include: {
            environment: { select: { id: true, key: true, name: true, status: true } },
            server: { select: { id: true, name: true, host: true, status: true } },
            proxyConfig: { select: { id: true, name: true, domain: true, status: true } },
          },
        },
        applications: {
          where: { status: { not: 'archived' } },
          orderBy: { createdAt: 'desc' },
          include: {
            services: {
              where: { status: { not: 'archived' } },
              orderBy: [{ environmentId: 'asc' }, { name: 'asc' }],
              include: {
                environment: { select: { id: true, key: true, name: true, status: true } },
                server: { select: { id: true, name: true, host: true, status: true } },
                site: { select: { id: true, name: true, primaryDomain: true, status: true } },
                managedResource: {
                  select: { id: true, name: true, provider: true, kind: true, status: true },
                },
                _count: { select: { deploymentRuns: true, operationRuns: true } },
              },
            },
            _count: { select: { services: true, deploymentRuns: true, operationRuns: true } },
          },
        },
        cdnConfigs: {
          include: {
            environment: { select: { id: true, key: true, name: true, status: true } },
          },
        },
        managedResources: {
          orderBy: [{ environmentId: 'asc' }, { updatedAt: 'desc' }],
          take: 30,
          select: {
            id: true,
            sourceType: true,
            provider: true,
            kind: true,
            name: true,
            externalId: true,
            status: true,
            endpoint: true,
            lastSyncAt: true,
            environment: { select: { id: true, key: true, name: true, status: true } },
            server: { select: { id: true, name: true, host: true, status: true } },
            credential: { select: { id: true, name: true, type: true } },
          },
        },
        resourceInstances: {
          orderBy: [{ environmentId: 'asc' }, { createdAt: 'desc' }],
          take: 30,
          select: {
            id: true,
            name: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            projectEnvironment: { select: { id: true, key: true, name: true, status: true } },
            resourceType: { select: { id: true, key: true, name: true, category: true } },
            request: { select: { id: true, title: true, status: true } },
          },
        },
        secretKeys: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            environment: { select: { id: true, key: true, name: true, status: true } },
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  async findGeneratedArtifactProject(teamId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        name: true,
        config: true,
        downloadUrl: true,
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  async attachGeneratedProjectArtifact(
    teamId: string,
    id: string,
    config: object,
    artifact: GeneratedProjectArtifactInput,
  ) {
    const existing = await this.prisma.project.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('项目不存在');
    }

    const normalizedConfig = this.normalizeProjectConfig(
      {
        name: existing.name,
        description: existing.description ?? undefined,
        config: {
          ...config,
          generatedArtifact: this.serializeGeneratedProjectArtifact(artifact),
        },
      },
      existing.config,
    );

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        config: normalizedConfig,
        downloadUrl: artifact.downloadUrl,
      },
    });

    this.logger.log(`Generated artifact attached: ${id} (${artifact.downloadUrl})`);

    return project;
  }

  async recordGeneratedProjectArtifactDownload(
    teamId: string,
    id: string,
    actorId: string,
    artifact: GeneratedProjectArtifactInput,
  ) {
    const existing = await this.prisma.project.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('项目不存在');
    }

    const existingConfig = isRecord(existing.config) ? existing.config : {};
    const existingArtifact = isRecord(existingConfig.generatedArtifact) ? existingConfig.generatedArtifact : {};
    const currentDownloadCount = typeof existingArtifact.downloadCount === 'number'
      ? existingArtifact.downloadCount
      : artifact.downloadCount ?? 0;
    const downloadedAt = new Date().toISOString();
    const nextArtifact = this.serializeGeneratedProjectArtifact({
      ...artifact,
      downloadCount: currentDownloadCount + 1,
      lastDownloadedAt: downloadedAt,
      lastDownloadedBy: actorId,
    });

    const normalizedConfig = this.normalizeProjectConfig(
      {
        name: existing.name,
        description: existing.description ?? undefined,
        config: {
          ...existingConfig,
          generatedArtifact: nextArtifact,
        },
      },
      existing.config,
    );

    return this.prisma.project.update({
      where: { id },
      data: {
        config: normalizedConfig,
      },
    });
  }

  async update(teamId: string, id: string, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('项目不存在');
    }

    const config =
      dto.config || dto.origin
        ? this.normalizeProjectConfig(
            {
              name: dto.name ?? existing.name,
              description: dto.description ?? existing.description ?? undefined,
              config: dto.config,
              origin: dto.origin,
            },
            existing.config,
          )
        : undefined;

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        config,
        gitRepo: dto.gitRepo,
      },
    });

    if (config) {
      await this.projectEnvironmentService.ensureDefaultsForProject(teamId, project.id, config);
    }

    this.logger.log(`Project updated: ${id}`);

    return project;
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.project.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('项目不存在');
    }

    await this.prisma.project.delete({ where: { id } });

    this.logger.log(`Project deleted: ${id}`);

    return { success: true };
  }

  private normalizeProjectConfig(
    input: ProjectConfigInput,
    existingConfig?: unknown,
  ): Prisma.InputJsonObject {
    const existing = isRecord(existingConfig) ? existingConfig : {};
    const config = isRecord(input.config) ? input.config : existing;
    const basicInfo = isRecord(config.basicInfo) ? config.basicInfo : undefined;
    const existingBasicInfo = isRecord(existing.basicInfo) ? existing.basicInfo : undefined;

    const inferredOrigin =
      input.origin ??
      readOrigin(config.origin) ??
      readOrigin(config.mode) ??
      readOrigin(existing.origin) ??
      readOrigin(existing.mode) ??
      (basicInfo || isRecord(config.subProjects) ? 'generated' : 'imported');

    const description =
      readString(config.description) ??
      input.description ??
      readString(basicInfo?.description) ??
      readString(existing.description) ??
      readString(existingBasicInfo?.description);

    const projectName =
      readString(config.projectName) ??
      input.name ??
      readString(basicInfo?.name) ??
      readString(existing.projectName) ??
      readString(existingBasicInfo?.name);
    const environments = readStringArray(config.environments);

    return {
      ...config,
      origin: inferredOrigin,
      mode: readString(config.mode) ?? inferredOrigin,
      environments: environments.length > 0 ? environments : DEFAULT_PROJECT_ENVIRONMENT_KEYS,
      ...(projectName ? { projectName } : {}),
      ...(description ? { description } : {}),
      initialized:
        readBoolean(config.initialized) ??
        readBoolean(existing.initialized) ??
        inferredOrigin === 'generated',
    } as Prisma.InputJsonObject;
  }

  private serializeGeneratedProjectArtifact(artifact: GeneratedProjectArtifactInput): Prisma.InputJsonObject {
    return {
      kind: artifact.kind,
      storage: artifact.storage,
      fileName: artifact.fileName,
      size: artifact.size,
      sha256: artifact.sha256,
      generatedAt: artifact.generatedAt,
      downloadUrl: artifact.downloadUrl,
      retentionDays: artifact.retentionDays,
      expiresAt: artifact.expiresAt,
      ...(artifact.lastDownloadedAt ? { lastDownloadedAt: artifact.lastDownloadedAt } : {}),
      ...(artifact.lastDownloadedBy ? { lastDownloadedBy: artifact.lastDownloadedBy } : {}),
      ...(typeof artifact.downloadCount === 'number' ? { downloadCount: artifact.downloadCount } : {}),
    };
  }
}
