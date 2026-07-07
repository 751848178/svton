import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { SiteService } from '../site';
import { CryptoService } from '../common/crypto/crypto.service';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import {
  environmentKeysFromConfig as environmentKeysFromConfigUtil,
  labelForKey as labelForKeyUtil,
  normalizeKey as normalizeKeyUtil,
  normalizeResourceBindingTypes as normalizeResourceBindingTypesUtil,
  sortOrderForKey as sortOrderForKeyUtil,
  toJsonValue as toJsonValueUtil,
} from './project-environment-helpers.utils';
import {
  buildResourceBulkBindingAuditInput,
  buildServerBindingAuditInput,
  buildSiteCopyAuditInput,
} from './project-environment-audit.utils';
import { ProjectEnvironmentCopySiteService } from './project-environment-copy-site.service';
import { ProjectEnvironmentSyncService } from './project-environment-sync.service';
import { ProjectEnvironmentSyncApplyService } from './project-environment-sync-apply.service';
import { ProjectEnvironmentResourceCopyService } from './project-environment-resource-copy.service';
import { ProjectEnvironmentCdnCopyService } from './project-environment-cdn-copy.service';
import {
  buildSiteCopyQueuedLiveSyncFollowUp as buildSiteCopyQueuedLiveSyncFollowUpUtil,
  resourceBindingStep as resourceBindingStepUtil,
} from './project-environment-copy.utils';
import {
  ApplyProjectEnvironmentSyncSuggestionsDto,
  BindProjectEnvironmentServerDto,
  BulkBindProjectEnvironmentResourcesDto,
  CopyProjectEnvironmentCdnConfigsDto,
  CopyProjectEnvironmentResourcesDto,
  CopyProjectEnvironmentSitesDto,
  CreateProjectEnvironmentDto,
  ListProjectEnvironmentSyncSuggestionsQueryDto,
  ListProjectEnvironmentsQueryDto,
  UpdateProjectEnvironmentDto,
} from './dto/project-environment.dto';

const ENVIRONMENT_LABELS: Record<string, string> = {
  dev: '开发',
  test: '测试',
  staging: '预发',
  prod: '生产',
};
const DEFAULT_PROJECT_ENVIRONMENT_KEYS = ['dev', 'test', 'staging', 'prod'];

function isSafeUpstreamUrl(upstream: string) {
  return /^https?:\/\/[a-zA-Z0-9._:-]+(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?$/.test(upstream)
    && !/[\s{};`$\\]/.test(upstream);
}

export type SuggestionSeverity = 'info' | 'warning' | 'critical';

export interface DeployConfigCoverage {
  total: number;
  workingDirectory: number;
  buildCommand: number;
  deployCommand: number;
  healthCheckUrl: number;
  rollbackCommand: number;
}

export type DeployConfigField = keyof Omit<DeployConfigCoverage, 'total'>;

export interface EnvironmentSyncProfile {
  environment: {
    id: string;
    key: string;
    name: string;
    status: string;
    sortOrder: number;
  };
  isReference: boolean;
  serverRoleKeys: string[];
  serverKeys: string[];
  serviceKeys: string[];
  resourceKindKeys: string[];
  siteRuntimeKeys: string[];
  secretTypeKeys: string[];
  cdnProviderKeys: string[];
  counts: {
    serverBindings: number;
    services: number;
    managedResources: number;
    resourceInstances: number;
    resources: number;
    sites: number;
    cdnConfigs: number;
    secretKeys: number;
    deploymentRuns: number;
  };
  deployConfigCoverage: DeployConfigCoverage;
  serviceBindingGapCount: number;
  tlsSiteCount: number;
  successfulDeployments: number;
}

export interface EnvironmentSyncDifferences {
  missing: {
    serverRoles: string[];
    services: string[];
    resourceKinds: string[];
    siteRuntimeTypes: string[];
    secretTypes: string[];
    cdnProviders: string[];
  };
  extra: {
    serverRoles: string[];
    services: string[];
    resourceKinds: string[];
    siteRuntimeTypes: string[];
    secretTypes: string[];
    cdnProviders: string[];
  };
  deployConfigGaps: Array<{ field: DeployConfigField; missingCount: number }>;
  serviceBindingGapDelta: number;
  tlsSiteGap: number;
  successfulDeploymentGap: boolean;
}

export interface EnvironmentSyncSuggestionAction {
  kind: string;
  severity: SuggestionSeverity;
  title: string;
  description: string;
  target: 'resource-control' | 'applications' | 'sites' | 'keys' | 'cdn-configs';
  metadata: Record<string, unknown>;
}

type EnvironmentResourceBindingType = 'managed_resource' | 'resource_instance' | 'site' | 'cdn_config' | 'secret_key';

type EnvironmentResourceBindingStep = {
  type: EnvironmentResourceBindingType;
  status: 'planned' | 'applied' | 'skipped';
  resourceId: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

type EnvironmentSiteCopyStep = {
  status: 'planned' | 'applied' | 'skipped';
  sourceSiteId: string;
  targetSiteId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

type SiteCopyQueuedLiveSyncAlertLevel = 'info' | 'warning' | 'critical';

type SiteCopyQueuedLiveSyncFollowUpItem = {
  sourceSiteId: string;
  targetSiteId: string | null;
  syncRunId: string | null;
  syncStatus: string;
  approvalId: string | null;
  approvalStatus: string | null;
  serverExecutionJobId: string | null;
  action: 'approval_required' | 'monitor_queue' | 'investigate_failure' | 'monitor_sync' | 'none';
  alertLevel: SiteCopyQueuedLiveSyncAlertLevel;
};

type SiteCopyQueuedLiveSyncAlert = {
  level: SiteCopyQueuedLiveSyncAlertLevel;
  code: string;
  message: string;
  sourceSiteId: string;
  targetSiteId: string | null;
  syncRunId: string | null;
  approvalId: string | null;
};

type SiteCopyQueuedLiveSyncFollowUp = {
  requestedCount: number;
  statusCounts: Record<string, number>;
  metrics: {
    pendingApprovalCount: number;
    queuedJobCount: number;
    blockedCount: number;
    completedCount: number;
    failedCount: number;
    unknownCount: number;
  };
  items: SiteCopyQueuedLiveSyncFollowUpItem[];
  alerts: SiteCopyQueuedLiveSyncAlert[];
};

const DEFAULT_RESOURCE_BINDING_TYPES: EnvironmentResourceBindingType[] = [
  'managed_resource',
  'resource_instance',
  'site',
  'cdn_config',
  'secret_key',
];

@Injectable()
export class ProjectEnvironmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ProjectEnvironmentRepository,
    private readonly copySiteService: ProjectEnvironmentCopySiteService,
    private readonly syncService: ProjectEnvironmentSyncService,
    private readonly syncApplyService: ProjectEnvironmentSyncApplyService,
    private readonly resourceCopyService: ProjectEnvironmentResourceCopyService,
    private readonly cdnCopyService: ProjectEnvironmentCdnCopyService,
    @Optional()
    private readonly auditEventService: AuditEventService,
    @Optional()
    private readonly siteService: SiteService,
    private readonly cryptoService: CryptoService,
  ) {}

  private encryptSecretValue(text: string): string {
    return this.cryptoService.encryptCbc(text);
  }

  async list(teamId: string, query: ListProjectEnvironmentsQueryDto) {
    const where: Prisma.ProjectEnvironmentWhereInput = { teamId };

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.status) {
      where.status = query.status;
    }

    return this.repo.findProjectEnvironments({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        project: { select: { id: true, name: true } },
      },
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
      include: {
        project: { select: { id: true, name: true } },
      },
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
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async archive(teamId: string, id: string) {
    await this.get(teamId, id);

    return this.repo.updateProjectEnvironment({
      where: { id },
      data: { status: 'archived' },
    });
  }

  async syncFromProject(teamId: string, projectId: string) {
    const project = await this.assertProject(teamId, projectId);
    await this.ensureDefaultsForProject(teamId, project.id, project.config);
    return this.list(teamId, { projectId });
  }

  listSyncSuggestions = (
    teamId: string,
    query: ListProjectEnvironmentSyncSuggestionsQueryDto,
    readableEnvironmentIds?: string[],
  ) => this.syncService.listSyncSuggestions(teamId, query, readableEnvironmentIds);

  getSyncApplyAccessScope = (teamId: string, dto: ApplyProjectEnvironmentSyncSuggestionsDto) =>
    this.syncApplyService.getSyncApplyAccessScope(teamId, dto);

  applySyncSuggestions = (teamId: string, userId: string, dto: ApplyProjectEnvironmentSyncSuggestionsDto) =>
    this.syncApplyService.applySyncSuggestions(teamId, userId, dto);


  async getResourceBulkBindingAccessScope(teamId: string, dto: BulkBindProjectEnvironmentResourcesDto) {
    const environment = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.environmentId);
    return {
      projectId: environment.projectId,
      environmentId: environment.id,
    };
  }

  async bulkBindResources(teamId: string, userId: string, dto: BulkBindProjectEnvironmentResourcesDto) {
    if (!dto.projectId || !dto.environmentId) {
      throw new BadRequestException('projectId 和 environmentId 不能为空');
    }

    const dryRun = dto.dryRun !== false;
    const environment = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.environmentId);
    if (!dryRun && dto.confirmationText !== environment.name && dto.confirmationText !== environment.key) {
      throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${environment.name} / ${environment.key}`);
    }

    const requestedTypes = normalizeResourceBindingTypesUtil(dto.resourceTypes);
    const resourceIds = dto.resourceIds || {};
    const [
      managedResources,
      resourceInstances,
      sites,
      cdnConfigs,
      secretKeys,
    ] = await Promise.all([
      requestedTypes.has('managed_resource')
        ? this.repo.findManagedResources({
            where: {
              teamId,
              projectId: dto.projectId,
              environmentId: null,
              ...(resourceIds.managedResourceIds?.length ? { id: { in: resourceIds.managedResourceIds } } : {}),
            },
            select: { id: true, name: true, provider: true, kind: true, status: true, endpoint: true },
            orderBy: [{ provider: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
          })
        : Promise.resolve([]),
      requestedTypes.has('resource_instance')
        ? this.repo.findResourceInstances({
            where: {
              teamId,
              projectId: dto.projectId,
              environmentId: null,
              ...(resourceIds.resourceInstanceIds?.length ? { id: { in: resourceIds.resourceInstanceIds } } : {}),
            },
            select: {
              id: true,
              name: true,
              status: true,
              resourceType: { select: { id: true, key: true, name: true, category: true } },
            },
            orderBy: [{ status: 'asc' }, { name: 'asc' }],
          })
        : Promise.resolve([]),
      requestedTypes.has('site')
        ? this.repo.findSites({
            where: {
              teamId,
              projectId: dto.projectId,
              environmentId: null,
              ...(resourceIds.siteIds?.length ? { id: { in: resourceIds.siteIds } } : {}),
            },
            select: { id: true, name: true, primaryDomain: true, runtimeType: true, status: true },
            orderBy: [{ status: 'asc' }, { name: 'asc' }],
          })
        : Promise.resolve([]),
      requestedTypes.has('cdn_config')
        ? this.repo.findCDNConfigs({
            where: {
              teamId,
              projectId: dto.projectId,
              environmentId: null,
              ...(resourceIds.cdnConfigIds?.length ? { id: { in: resourceIds.cdnConfigIds } } : {}),
            },
            select: { id: true, name: true, domain: true, provider: true, status: true },
            orderBy: [{ provider: 'asc' }, { name: 'asc' }],
          })
        : Promise.resolve([]),
      requestedTypes.has('secret_key')
        ? this.repo.findSecretKeys({
            where: {
              teamId,
              projectId: dto.projectId,
              environmentId: null,
              ...(resourceIds.secretKeyIds?.length ? { id: { in: resourceIds.secretKeyIds } } : {}),
            },
            select: { id: true, name: true, type: true, description: true },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

    const steps: EnvironmentResourceBindingStep[] = [
      ...managedResources.map((resource: any) => resourceBindingStepUtil(
        'managed_resource',
        dryRun ? 'planned' : 'applied',
        resource.id,
        `${resource.provider}/${resource.kind} ${resource.name}`,
        `绑定托管资源到 ${environment.name}`,
        { provider: resource.provider, kind: resource.kind, status: resource.status, endpoint: resource.endpoint },
      )),
      ...resourceInstances.map((resource: any) => resourceBindingStepUtil(
        'resource_instance',
        dryRun ? 'planned' : 'applied',
        resource.id,
        `资源实例 ${resource.name}`,
        `绑定资源实例到 ${environment.name}`,
        { status: resource.status, resourceType: resource.resourceType?.key || resource.resourceType?.name },
      )),
      ...sites.map((site: any) => resourceBindingStepUtil(
        'site',
        dryRun ? 'planned' : 'applied',
        site.id,
        `站点 ${site.name}`,
        `绑定站点 ${site.primaryDomain} 到 ${environment.name}`,
        { runtimeType: site.runtimeType, status: site.status, primaryDomain: site.primaryDomain },
      )),
      ...cdnConfigs.map((config: any) => resourceBindingStepUtil(
        'cdn_config',
        dryRun ? 'planned' : 'applied',
        config.id,
        `CDN ${config.name}`,
        `绑定 CDN ${config.domain} 到 ${environment.name}`,
        { provider: config.provider, status: config.status, domain: config.domain },
      )),
      ...secretKeys.map((secret: any) => resourceBindingStepUtil(
        'secret_key',
        dryRun ? 'planned' : 'applied',
        secret.id,
        `密钥 ${secret.name}`,
        `绑定密钥类型 ${secret.type} 到 ${environment.name}，不会读取或修改密钥值`,
        { type: secret.type, hasDescription: Boolean(secret.description) },
      )),
    ];

    if (!dryRun) {
      await this.applyResourceEnvironmentBinding(teamId, dto.projectId, environment.id, {
        managedResourceIds: managedResources.map((resource: any) => resource.id),
        resourceInstanceIds: resourceInstances.map((resource: any) => resource.id),
        siteIds: sites.map((site: any) => site.id),
        cdnConfigIds: cdnConfigs.map((config: any) => config.id),
        secretKeyIds: secretKeys.map((secret: any) => secret.id),
      });
    }

    const result = {
      projectId: dto.projectId,
      environment: { id: environment.id, key: environment.key, name: environment.name },
      dryRun,
      status: dryRun ? 'planned' : 'completed',
      plannedCount: steps.filter((step) => step.status === 'planned').length,
      appliedCount: steps.filter((step) => step.status === 'applied').length,
      skippedCount: steps.filter((step) => step.status === 'skipped').length,
      steps,
      summary: {
        managedResources: managedResources.length,
        resourceInstances: resourceInstances.length,
        sites: sites.length,
        cdnConfigs: cdnConfigs.length,
        secretKeys: secretKeys.length,
      },
      warnings: [
        '只绑定现有项目资源的环境归属，不复制、创建或删除实际服务器/云资源。',
        '密钥只更新 environmentId，不读取、不解密、不修改 value。',
      ],
    };

    await this.auditEventService?.create(buildResourceBulkBindingAuditInput(teamId, userId, result) as any);
    return result;
  }


  getCdnConfigCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentCdnConfigsDto) =>
    this.cdnCopyService.getCdnConfigCopyAccessScope(teamId, dto);

  copyCdnConfigs = (teamId: string, userId: string, dto: CopyProjectEnvironmentCdnConfigsDto) =>
    this.cdnCopyService.copyCdnConfigs(teamId, userId, dto);

  getResourceCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentResourcesDto) =>
    this.resourceCopyService.getResourceCopyAccessScope(teamId, dto);

  copyResources = (teamId: string, userId: string, dto: CopyProjectEnvironmentResourcesDto) =>
    this.resourceCopyService.copyResources(teamId, userId, dto);

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
    return {
      projectId: environment.projectId,
      environmentId: environment.id,
    };
  }

  async bindServer(teamId: string, userId: string, environmentId: string, dto: BindProjectEnvironmentServerDto) {
    const environment = await this.get(teamId, environmentId);
    await this.assertServer(teamId, dto.serverId);

    const binding = await this.repo.upsertProjectEnvironmentServer({
      where: {
        environmentId_serverId: {
          environmentId: environment.id,
          serverId: dto.serverId,
        },
      },
      create: {
        teamId,
        projectId: environment.projectId,
        environmentId: environment.id,
        serverId: dto.serverId,
        role: dto.role || null,
        metadata: dto.metadata ? toJsonValueUtil(dto.metadata) : undefined,
      },
      update: {
        projectId: environment.projectId,
        role: dto.role || null,
        status: 'active',
        metadata: dto.metadata ? toJsonValueUtil(dto.metadata) : undefined,
      },
      include: {
        server: { select: { id: true, name: true, host: true, status: true, services: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
      },
    });

    await this.auditEventService?.create(buildServerBindingAuditInput(teamId, userId, {
      projectId: environment.projectId,
      environmentId: environment.id,
      environmentName: environment.name,
      serverId: dto.serverId,
      serverName: binding.server.name,
      role: dto.role || null,
      action: 'bind',
      status: 'completed',
    }) as any);

    return binding;
  }

  async unbindServer(teamId: string, userId: string, environmentId: string, serverId: string) {
    const environment = await this.get(teamId, environmentId);
    const binding = await this.repo.findProjectEnvironmentServer({
      where: { teamId, environmentId: environment.id, serverId },
      select: {
        id: true,
        role: true,
        server: { select: { id: true, name: true } },
      },
    });

    if (!binding) {
      throw new NotFoundException('环境服务器绑定不存在');
    }

    await this.repo.deleteProjectEnvironmentServer({ where: { id: binding.id } });
    await this.auditEventService?.create(buildServerBindingAuditInput(teamId, userId, {
      projectId: environment.projectId,
      environmentId: environment.id,
      environmentName: environment.name,
      serverId,
      serverName: binding.server.name,
      role: binding.role,
      action: 'unbind',
      status: 'completed',
    }) as any);

    return { success: true };
  }

  async ensureDefaultsForProject(teamId: string, projectId: string, config: unknown) {
    const keys = environmentKeysFromConfigUtil(config);

    for (const [index, key] of keys.entries()) {
      await this.repo.upsertProjectEnvironment({
        where: {
          projectId_key: {
            projectId,
            key,
          },
        },
        create: {
          teamId,
          projectId,
          key,
          name: labelForKeyUtil(key),
          sortOrder: index * 10,
          config: toJsonValueUtil({
            source: 'project_config',
            initializedBy: 'ProjectEnvironmentService.ensureDefaultsForProject',
          }),
        },
        update: {
          name: labelForKeyUtil(key),
          sortOrder: index * 10,
          status: 'active',
        },
      });
    }
  }

  private async get(teamId: string, id: string) {
    const environment = await this.repo.findProjectEnvironment({
      where: { id, teamId },
    });

    if (!environment) {
      throw new NotFoundException('项目环境不存在');
    }

    return environment;
  }

  private async assertProject(teamId: string, projectId: string) {
    const project = await this.repo.findProject({
      where: { id: projectId, teamId },
      select: { id: true, config: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在或不属于当前团队');
    }

    return project;
  }

  private async assertServer(teamId: string, serverId: string) {
    const server = await this.repo.findServer({
      where: { id: serverId, teamId },
      select: { id: true },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在或不属于当前团队');
    }

    return server;
  }

  private async assertTeamCredential(teamId: string, credentialId: string) {
    const credential = await this.repo.findTeamCredential({
      where: { id: credentialId, teamId },
      select: { id: true },
    });

    if (!credential) {
      throw new NotFoundException('凭据不存在或不属于当前团队');
    }

    return credential;
  }



  private async resolveProjectEnvironment(teamId: string, projectId: string, environmentId: string) {
    const environment = await this.repo.findProjectEnvironment({
      where: { id: environmentId, teamId, projectId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true, status: true },
    });

    if (!environment) {
      throw new NotFoundException('项目环境不存在或不可用');
    }

    return environment;
  }





  private async applyResourceEnvironmentBinding(
    teamId: string,
    projectId: string,
    environmentId: string,
    ids: {
      managedResourceIds: string[];
      resourceInstanceIds: string[];
      siteIds: string[];
      cdnConfigIds: string[];
      secretKeyIds: string[];
    },
  ) {
    const updates: Array<Promise<unknown>> = [];

    if (ids.managedResourceIds.length > 0) {
      updates.push(this.repo.updateManagedResources({
        where: { teamId, projectId, environmentId: null, id: { in: ids.managedResourceIds } },
        data: { environmentId },
      }));
    }
    if (ids.resourceInstanceIds.length > 0) {
      updates.push(this.repo.updateResourceInstances({
        where: { teamId, projectId, environmentId: null, id: { in: ids.resourceInstanceIds } },
        data: { environmentId },
      }));
    }
    if (ids.siteIds.length > 0) {
      updates.push(this.repo.updateSites({
        where: { teamId, projectId, environmentId: null, id: { in: ids.siteIds } },
        data: { environmentId },
      }));
    }
    if (ids.cdnConfigIds.length > 0) {
      updates.push(this.repo.updateCDNConfigs({
        where: { teamId, projectId, environmentId: null, id: { in: ids.cdnConfigIds } },
        data: { environmentId },
      }));
    }
    if (ids.secretKeyIds.length > 0) {
      updates.push(this.repo.updateSecretKeys({
        where: { teamId, projectId, environmentId: null, id: { in: ids.secretKeyIds } },
        data: { environmentId },
      }));
    }

    await Promise.all(updates);
  }

  getSiteCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentSitesDto) =>
    this.copySiteService.getSiteCopyAccessScope(teamId, dto);
  copySites = (teamId: string, userId: string, dto: CopyProjectEnvironmentSitesDto) =>
    this.copySiteService.copySites(teamId, userId, dto);
}
