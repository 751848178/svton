import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
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

const DEPLOY_CONFIG_FIELDS: DeployConfigField[] = [
  'workingDirectory',
  'buildCommand',
  'deployCommand',
  'healthCheckUrl',
  'rollbackCommand',
];

const DEPLOY_CONFIG_FIELD_LABELS: Record<DeployConfigField, string> = {
  workingDirectory: '工作目录',
  buildCommand: '构建命令',
  deployCommand: '部署命令',
  healthCheckUrl: '健康检查',
  rollbackCommand: '回滚命令',
};

const APPLYABLE_SYNC_ACTION_KINDS = new Set([
  'create_missing_service',
  'complete_deploy_config',
]);

const DEFAULT_SYNC_ACTION_KINDS = [
  'create_missing_service',
  'complete_deploy_config',
  'bind_server_role',
  'bind_service_runtime',
  'bind_resource_kind',
  'create_site_runtime',
  'create_cdn_config',
  'create_secret_type',
  'enable_site_tls',
  'run_deployment',
];

type EnvironmentSyncApplyStepStatus = 'planned' | 'applied' | 'skipped';

type EnvironmentSyncApplyStep = {
  kind: string;
  status: EnvironmentSyncApplyStepStatus;
  title: string;
  description: string;
  targetType: string;
  sourceId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

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

type EnvironmentCdnConfigCopyStep = {
  status: 'planned' | 'applied' | 'skipped';
  sourceCdnConfigId: string;
  targetCdnConfigId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

type EnvironmentResourceCopyStep = {
  type: 'managed_resource' | 'secret_key';
  status: 'planned' | 'applied' | 'skipped';
  sourceId: string;
  targetId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
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
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long!!!!!';

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly auditEventService?: AuditEventService,
  ) {}

  private encryptSecretValue(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey.padEnd(32).slice(0, 32)),
      iv,
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  async list(teamId: string, query: ListProjectEnvironmentsQueryDto) {
    const where: Prisma.ProjectEnvironmentWhereInput = { teamId };

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.projectEnvironment.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async create(teamId: string, dto: CreateProjectEnvironmentDto) {
    await this.assertProject(teamId, dto.projectId);
    const key = this.normalizeKey(dto.key);

    return this.prisma.projectEnvironment.create({
      data: {
        teamId,
        projectId: dto.projectId,
        key,
        name: dto.name || this.labelForKey(key),
        description: dto.description,
        sortOrder: dto.sortOrder ?? this.sortOrderForKey(key),
        config: dto.config ? this.toJsonValue(dto.config) : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async update(teamId: string, id: string, dto: UpdateProjectEnvironmentDto) {
    const existing = await this.get(teamId, id);
    const key = dto.key === undefined ? undefined : this.normalizeKey(dto.key);

    return this.prisma.projectEnvironment.update({
      where: { id: existing.id },
      data: {
        key,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        sortOrder: dto.sortOrder,
        config: dto.config !== undefined ? this.toJsonValue(dto.config) : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async archive(teamId: string, id: string) {
    await this.get(teamId, id);

    return this.prisma.projectEnvironment.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  async syncFromProject(teamId: string, projectId: string) {
    const project = await this.assertProject(teamId, projectId);
    await this.ensureDefaultsForProject(teamId, project.id, project.config);
    return this.list(teamId, { projectId });
  }

  async listSyncSuggestions(
    teamId: string,
    query: ListProjectEnvironmentSyncSuggestionsQueryDto,
    readableEnvironmentIds?: string[],
  ) {
    if (!query.projectId) {
      throw new BadRequestException('projectId 不能为空');
    }

    const project = await this.assertProject(teamId, query.projectId);
    const readableIdSet = readableEnvironmentIds ? new Set(readableEnvironmentIds) : null;

    const environments = await this.prisma.projectEnvironment.findMany({
      where: {
        teamId,
        projectId: project.id,
        status: 'active',
        ...(readableIdSet ? { id: { in: [...readableIdSet] } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        serverBindings: {
          where: { status: 'active' },
          include: {
            server: { select: { id: true, name: true, host: true, status: true } },
          },
        },
      },
    });

    const environmentIds = environments.map((environment) => environment.id);
    if (environmentIds.length === 0) {
      return {
        projectId: project.id,
        referenceEnvironment: null,
        profiles: [],
        summary: {
          environmentCount: 0,
          actionCount: 0,
          differenceCount: 0,
        },
      };
    }

    const [
      services,
      deploymentRuns,
      sites,
      managedResources,
      resourceInstances,
      cdnConfigs,
      secretKeys,
    ] = await Promise.all([
      this.prisma.applicationService.findMany({
        where: {
          teamId,
          projectId: project.id,
          environmentId: { in: environmentIds },
          status: { not: 'archived' },
        },
        select: {
          id: true,
          name: true,
          kind: true,
          runtime: true,
          environmentId: true,
          serverId: true,
          siteId: true,
          managedResourceId: true,
          deployConfig: true,
          application: { select: { id: true, name: true } },
        },
      }),
      this.prisma.deploymentRun.findMany({
        where: {
          teamId,
          projectId: project.id,
          environmentId: { in: environmentIds },
        },
        select: { id: true, environmentId: true, status: true },
      }),
      this.prisma.site.findMany({
        where: {
          teamId,
          projectId: project.id,
          environmentId: { in: environmentIds },
        },
        select: { id: true, environmentId: true, runtimeType: true, tls: true, serverId: true },
      }),
      this.prisma.managedResource.findMany({
        where: {
          teamId,
          projectId: project.id,
          environmentId: { in: environmentIds },
        },
        select: { id: true, environmentId: true, provider: true, kind: true },
      }),
      this.prisma.resourceInstance.findMany({
        where: {
          teamId,
          projectId: project.id,
          environmentId: { in: environmentIds },
        },
        select: {
          id: true,
          environmentId: true,
          resourceType: { select: { id: true, key: true, name: true, category: true } },
        },
      }),
      this.prisma.cDNConfig.findMany({
        where: {
          teamId,
          projectId: project.id,
          environmentId: { in: environmentIds },
        },
        select: { id: true, environmentId: true, provider: true, status: true },
      }),
      this.prisma.secretKey.findMany({
        where: {
          teamId,
          projectId: project.id,
          environmentId: { in: environmentIds },
        },
        select: { id: true, environmentId: true, type: true },
      }),
    ]);

    const servicesByEnvironment = this.groupByEnvironment(services);
    const deploymentRunsByEnvironment = this.groupByEnvironment(deploymentRuns);
    const sitesByEnvironment = this.groupByEnvironment(sites);
    const managedResourcesByEnvironment = this.groupByEnvironment(managedResources);
    const resourceInstancesByEnvironment = this.groupByEnvironment(resourceInstances);
    const cdnConfigsByEnvironment = this.groupByEnvironment(cdnConfigs);
    const secretKeysByEnvironment = this.groupByEnvironment(secretKeys);

    const baseProfiles: EnvironmentSyncProfile[] = environments.map((environment) => {
      const environmentServices = servicesByEnvironment.get(environment.id) || [];
      const environmentDeploymentRuns = deploymentRunsByEnvironment.get(environment.id) || [];
      const environmentSites = sitesByEnvironment.get(environment.id) || [];
      const environmentManagedResources = managedResourcesByEnvironment.get(environment.id) || [];
      const environmentResourceInstances = resourceInstancesByEnvironment.get(environment.id) || [];
      const environmentCdnConfigs = cdnConfigsByEnvironment.get(environment.id) || [];
      const environmentSecretKeys = secretKeysByEnvironment.get(environment.id) || [];

      return {
        environment: {
          id: environment.id,
          key: environment.key,
          name: environment.name,
          status: environment.status,
          sortOrder: environment.sortOrder,
        },
        isReference: false,
        serverRoleKeys: this.uniqueSorted(
          environment.serverBindings.map((binding) => binding.role || 'mixed'),
        ),
        serverKeys: this.uniqueSorted(
          environment.serverBindings.map((binding) => binding.server.host || binding.server.name),
        ),
        serviceKeys: this.uniqueSorted(
          environmentServices.map((service) => `${service.application.name}/${service.name}`),
        ),
        resourceKindKeys: this.uniqueSorted([
          ...environmentManagedResources.map((resource) => `${resource.provider}/${resource.kind}`),
          ...environmentResourceInstances.map((instance) =>
            instance.resourceType?.key || instance.resourceType?.name || 'resource_instance',
          ),
        ]),
        siteRuntimeKeys: this.uniqueSorted(environmentSites.map((site) => site.runtimeType)),
        secretTypeKeys: this.uniqueSorted(environmentSecretKeys.map((secret) => secret.type)),
        cdnProviderKeys: this.uniqueSorted(environmentCdnConfigs.map((config) => config.provider)),
        counts: {
          serverBindings: environment.serverBindings.length,
          services: environmentServices.length,
          managedResources: environmentManagedResources.length,
          resourceInstances: environmentResourceInstances.length,
          resources: environmentManagedResources.length + environmentResourceInstances.length,
          sites: environmentSites.length,
          cdnConfigs: environmentCdnConfigs.length,
          secretKeys: environmentSecretKeys.length,
          deploymentRuns: environmentDeploymentRuns.length,
        },
        deployConfigCoverage: this.buildDeployConfigCoverage(environmentServices),
        serviceBindingGapCount: environmentServices.filter((service) =>
          !service.serverId && !service.siteId && !service.managedResourceId,
        ).length,
        tlsSiteCount: environmentSites.filter((site) => this.siteTlsEnabled(site.tls)).length,
        successfulDeployments: environmentDeploymentRuns.filter((run) => run.status === 'completed').length,
      };
    });

    const reference = this.findReferenceProfile(baseProfiles, query.referenceEnvironmentId);
    if (query.referenceEnvironmentId && !reference) {
      throw new BadRequestException('参考环境不存在或不可见');
    }

    const profiles = baseProfiles.map((profile) => {
      const isReference = Boolean(reference && profile.environment.id === reference.environment.id);
      const differences = reference
        ? this.buildSyncDifferences(profile, reference)
        : this.emptySyncDifferences();
      const actions = reference && !isReference
        ? this.buildSyncSuggestionActions(profile, reference, differences)
        : [];

      return {
        ...profile,
        isReference,
        differences,
        differenceLabels: isReference ? [] : this.buildDifferenceLabels(differences),
        actions,
      };
    });

    return {
      projectId: project.id,
      referenceEnvironment: reference?.environment || null,
      profiles,
      summary: {
        environmentCount: profiles.length,
        actionCount: profiles.reduce((sum, profile) => sum + profile.actions.length, 0),
        differenceCount: profiles.reduce((sum, profile) => sum + profile.differenceLabels.length, 0),
      },
    };
  }

  async getSyncApplyAccessScope(teamId: string, dto: ApplyProjectEnvironmentSyncSuggestionsDto) {
    const source = await this.get(teamId, dto.sourceEnvironmentId);
    const target = await this.get(teamId, dto.targetEnvironmentId);

    if (source.projectId !== dto.projectId || target.projectId !== dto.projectId || source.projectId !== target.projectId) {
      throw new BadRequestException('源环境、目标环境和项目不匹配');
    }

    return {
      projectId: source.projectId,
      sourceEnvironmentId: source.id,
      targetEnvironmentId: target.id,
    };
  }

  async applySyncSuggestions(teamId: string, userId: string, dto: ApplyProjectEnvironmentSyncSuggestionsDto) {
    if (!dto.projectId || !dto.sourceEnvironmentId || !dto.targetEnvironmentId) {
      throw new BadRequestException('projectId、sourceEnvironmentId 和 targetEnvironmentId 不能为空');
    }

    const dryRun = dto.dryRun !== false;
    const actionKinds = new Set(dto.actionKinds && dto.actionKinds.length > 0
      ? dto.actionKinds
      : DEFAULT_SYNC_ACTION_KINDS);
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);

    if (source.id === target.id) {
      throw new BadRequestException('源环境和目标环境不能相同');
    }
    if (!dryRun && dto.confirmationText !== target.name && dto.confirmationText !== target.key) {
      throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${target.name} / ${target.key}`);
    }

    const suggestions = await this.listSyncSuggestions(teamId, {
      projectId: dto.projectId,
      referenceEnvironmentId: source.id,
    }, [source.id, target.id]);
    const targetSuggestion = suggestions.profiles.find((profile) => profile.environment.id === target.id);

    const services = await this.prisma.applicationService.findMany({
      where: {
        teamId,
        projectId: dto.projectId,
        environmentId: { in: [source.id, target.id] },
        status: { not: 'archived' },
      },
      select: {
        id: true,
        applicationId: true,
        environmentId: true,
        name: true,
        kind: true,
        runtime: true,
        image: true,
        ports: true,
        deployConfig: true,
        metadata: true,
        serverId: true,
        siteId: true,
        managedResourceId: true,
        application: { select: { id: true, name: true } },
      },
    });
    const sourceServices = services.filter((service) => service.environmentId === source.id);
    const targetServices = services.filter((service) => service.environmentId === target.id);
    const targetServiceByKey = new Map(targetServices.map((service) => [
      this.applicationServiceSyncKey(service.applicationId, service.name),
      service,
    ]));
    const steps: EnvironmentSyncApplyStep[] = [];

    for (const sourceService of sourceServices) {
      const targetService = targetServiceByKey.get(
        this.applicationServiceSyncKey(sourceService.applicationId, sourceService.name),
      );
      const sourceDeployConfig = this.safeDeployConfig(sourceService.deployConfig);

      if (!targetService) {
        if (!actionKinds.has('create_missing_service')) {
          continue;
        }

        const copiedDeployConfigFields = Object.keys(sourceDeployConfig);
        if (dryRun) {
          steps.push({
            kind: 'create_missing_service',
            status: 'planned',
            title: `创建服务骨架 ${sourceService.application.name}/${sourceService.name}`,
            description: '将创建目标环境服务，但不会复制服务器、站点、托管资源、环境变量或密钥绑定。',
            targetType: 'application_service',
            sourceId: sourceService.id,
            metadata: {
              applicationId: sourceService.applicationId,
              serviceName: sourceService.name,
              copiedDeployConfigFields,
              skippedBindings: this.skippedServiceBindings(sourceService),
            },
          });
          continue;
        }

        const created = await this.prisma.applicationService.create({
          data: {
            teamId,
            projectId: dto.projectId,
            applicationId: sourceService.applicationId,
            environmentId: target.id,
            name: sourceService.name,
            kind: sourceService.kind,
            runtime: sourceService.runtime,
            image: sourceService.image,
            ports: sourceService.ports !== null ? this.toJsonValue(sourceService.ports) : undefined,
            deployConfig: copiedDeployConfigFields.length > 0 ? this.toJsonValue(sourceDeployConfig) : undefined,
            metadata: this.toJsonValue({
              environmentSync: {
                sourceEnvironmentId: source.id,
                targetEnvironmentId: target.id,
                sourceApplicationServiceId: sourceService.id,
                copiedDeployConfigFields,
                skippedBindings: this.skippedServiceBindings(sourceService),
                copiedBy: userId,
                copiedAt: new Date().toISOString(),
              },
            }),
          },
          select: { id: true },
        });
        steps.push({
          kind: 'create_missing_service',
          status: 'applied',
          title: `已创建服务骨架 ${sourceService.application.name}/${sourceService.name}`,
          description: '已创建目标环境服务，并跳过服务器、站点、托管资源、环境变量和密钥绑定。',
          targetType: 'application_service',
          sourceId: sourceService.id,
          targetId: created.id,
          metadata: {
            applicationId: sourceService.applicationId,
            serviceName: sourceService.name,
            copiedDeployConfigFields,
            skippedBindings: this.skippedServiceBindings(sourceService),
          },
        });
        continue;
      }

      if (!actionKinds.has('complete_deploy_config')) {
        continue;
      }

      const targetDeployConfig = this.recordFromJson(targetService.deployConfig);
      const missingFields = DEPLOY_CONFIG_FIELDS.filter((field) =>
        sourceDeployConfig[field] && !this.readConfigString(targetDeployConfig, field),
      );
      if (missingFields.length === 0) {
        continue;
      }

      if (dryRun) {
        steps.push({
          kind: 'complete_deploy_config',
          status: 'planned',
          title: `补齐部署配置 ${targetService.application.name}/${targetService.name}`,
          description: `将补齐 ${this.previewList(missingFields.map((field) => DEPLOY_CONFIG_FIELD_LABELS[field]))}，不会覆盖目标环境已有字段。`,
          targetType: 'application_service',
          sourceId: sourceService.id,
          targetId: targetService.id,
          metadata: {
            applicationId: targetService.applicationId,
            serviceName: targetService.name,
            fields: missingFields,
          },
        });
        continue;
      }

      const nextDeployConfig = {
        ...targetDeployConfig,
        ...Object.fromEntries(missingFields.map((field) => [field, sourceDeployConfig[field]])),
      };
      await this.prisma.applicationService.update({
        where: { id: targetService.id },
        data: { deployConfig: this.toJsonValue(nextDeployConfig) },
        select: { id: true },
      });
      steps.push({
        kind: 'complete_deploy_config',
        status: 'applied',
        title: `已补齐部署配置 ${targetService.application.name}/${targetService.name}`,
        description: `已补齐 ${this.previewList(missingFields.map((field) => DEPLOY_CONFIG_FIELD_LABELS[field]))}，未覆盖目标环境已有字段。`,
        targetType: 'application_service',
        sourceId: sourceService.id,
        targetId: targetService.id,
        metadata: {
          applicationId: targetService.applicationId,
          serviceName: targetService.name,
          fields: missingFields,
        },
      });
    }

    for (const action of targetSuggestion?.actions || []) {
      if (APPLYABLE_SYNC_ACTION_KINDS.has(action.kind) || !actionKinds.has(action.kind)) {
        continue;
      }

      steps.push({
        kind: action.kind,
        status: 'skipped',
        title: action.title,
        description: `${action.description} 当前版本只生成待办，不自动复制线上绑定、密钥或基础设施配置。`,
        targetType: action.target,
        metadata: action.metadata,
      });
    }

    const result = {
      projectId: dto.projectId,
      sourceEnvironment: { id: source.id, key: source.key, name: source.name },
      targetEnvironment: { id: target.id, key: target.key, name: target.name },
      dryRun,
      status: dryRun ? 'planned' : 'completed',
      plannedCount: steps.filter((step) => step.status === 'planned').length,
      appliedCount: steps.filter((step) => step.status === 'applied').length,
      skippedCount: steps.filter((step) => step.status === 'skipped').length,
      steps,
      warnings: [
        '不会复制环境变量、SecretKey 明文或 secretKeyIds。',
        '不会自动复制服务器、站点、托管资源、CDN 或密钥绑定；这些需要在对应控制台确认。',
      ],
    };

    await this.writeSyncApplyAudit(teamId, userId, result);
    return result;
  }

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

    const requestedTypes = this.normalizeResourceBindingTypes(dto.resourceTypes);
    const resourceIds = dto.resourceIds || {};
    const [
      managedResources,
      resourceInstances,
      sites,
      cdnConfigs,
      secretKeys,
    ] = await Promise.all([
      requestedTypes.has('managed_resource')
        ? this.prisma.managedResource.findMany({
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
        ? this.prisma.resourceInstance.findMany({
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
        ? this.prisma.site.findMany({
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
        ? this.prisma.cDNConfig.findMany({
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
        ? this.prisma.secretKey.findMany({
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
      ...managedResources.map((resource) => this.resourceBindingStep(
        'managed_resource',
        dryRun ? 'planned' : 'applied',
        resource.id,
        `${resource.provider}/${resource.kind} ${resource.name}`,
        `绑定托管资源到 ${environment.name}`,
        { provider: resource.provider, kind: resource.kind, status: resource.status, endpoint: resource.endpoint },
      )),
      ...resourceInstances.map((resource) => this.resourceBindingStep(
        'resource_instance',
        dryRun ? 'planned' : 'applied',
        resource.id,
        `资源实例 ${resource.name}`,
        `绑定资源实例到 ${environment.name}`,
        { status: resource.status, resourceType: resource.resourceType?.key || resource.resourceType?.name },
      )),
      ...sites.map((site) => this.resourceBindingStep(
        'site',
        dryRun ? 'planned' : 'applied',
        site.id,
        `站点 ${site.name}`,
        `绑定站点 ${site.primaryDomain} 到 ${environment.name}`,
        { runtimeType: site.runtimeType, status: site.status, primaryDomain: site.primaryDomain },
      )),
      ...cdnConfigs.map((config) => this.resourceBindingStep(
        'cdn_config',
        dryRun ? 'planned' : 'applied',
        config.id,
        `CDN ${config.name}`,
        `绑定 CDN ${config.domain} 到 ${environment.name}`,
        { provider: config.provider, status: config.status, domain: config.domain },
      )),
      ...secretKeys.map((secret) => this.resourceBindingStep(
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
        managedResourceIds: managedResources.map((resource) => resource.id),
        resourceInstanceIds: resourceInstances.map((resource) => resource.id),
        siteIds: sites.map((site) => site.id),
        cdnConfigIds: cdnConfigs.map((config) => config.id),
        secretKeyIds: secretKeys.map((secret) => secret.id),
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

    await this.writeResourceBulkBindingAudit(teamId, userId, result);
    return result;
  }

  async getSiteCopyAccessScope(teamId: string, dto: CopyProjectEnvironmentSitesDto) {
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    return {
      projectId: source.projectId,
      sourceEnvironmentId: source.id,
      targetEnvironmentId: target.id,
    };
  }

  async copySites(teamId: string, userId: string, dto: CopyProjectEnvironmentSitesDto) {
    if (!dto.projectId || !dto.sourceEnvironmentId || !dto.targetEnvironmentId) {
      throw new BadRequestException('projectId、sourceEnvironmentId 和 targetEnvironmentId 不能为空');
    }

    const dryRun = dto.dryRun !== false;
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    if (source.id === target.id) {
      throw new BadRequestException('源环境和目标环境不能相同');
    }
    if (!dryRun && dto.confirmationText !== target.name && dto.confirmationText !== target.key) {
      throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${target.name} / ${target.key}`);
    }

    const sourceSites = await this.prisma.site.findMany({
      where: {
        teamId,
        projectId: dto.projectId,
        environmentId: source.id,
        ...(dto.siteIds?.length ? { id: { in: dto.siteIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        primaryDomain: true,
        aliases: true,
        runtimeType: true,
        runtimeConfig: true,
        tls: true,
        accessPolicy: true,
        status: true,
      },
      orderBy: [{ name: 'asc' }, { primaryDomain: 'asc' }],
    });
    const targetSites = await this.prisma.site.findMany({
      where: { teamId, projectId: dto.projectId, environmentId: target.id },
      select: { id: true, primaryDomain: true },
    });
    const existingTargetDomains = new Set(targetSites.map((site) => site.primaryDomain));
    const targetDomainOverrides = dto.targetDomainOverrides || {};
    const steps: EnvironmentSiteCopyStep[] = [];

    for (const site of sourceSites) {
      const targetDomain = targetDomainOverrides[site.id]?.trim();
      const baseMetadata = {
        runtimeType: site.runtimeType,
        sourceDomain: site.primaryDomain,
        targetDomain: targetDomain || null,
      };

      if (!targetDomain) {
        steps.push({
          status: 'skipped',
          sourceSiteId: site.id,
          title: `站点 ${site.name}`,
          description: '缺少目标域名，apply 时不会自动复制该站点',
          metadata: { ...baseMetadata, reason: 'missing_target_domain' },
        });
        continue;
      }
      if (existingTargetDomains.has(targetDomain)) {
        steps.push({
          status: 'skipped',
          sourceSiteId: site.id,
          title: `站点 ${site.name}`,
          description: `目标环境已存在域名 ${targetDomain}`,
          metadata: { ...baseMetadata, reason: 'target_domain_exists' },
        });
        continue;
      }

      if (dryRun) {
        steps.push({
          status: 'planned',
          sourceSiteId: site.id,
          title: `复制站点 ${site.name}`,
          description: `将以 draft 站点复制到 ${target.name}，目标域名 ${targetDomain}`,
          metadata: baseMetadata,
        });
        continue;
      }

      const created = await this.prisma.site.create({
        data: {
          teamId,
          createdById: userId,
          projectId: dto.projectId,
          environmentId: target.id,
          name: `${site.name} (${target.name})`,
          primaryDomain: targetDomain,
          aliases: site.aliases ? this.toJsonValue(site.aliases) : undefined,
          runtimeType: site.runtimeType,
          runtimeConfig: site.runtimeConfig ? this.toJsonValue(site.runtimeConfig) : undefined,
          tls: this.toJsonValue(this.sanitizeSiteTlsForCopy(site.tls)),
          accessPolicy: site.accessPolicy ? this.toJsonValue(site.accessPolicy) : undefined,
          status: 'draft',
        },
        select: { id: true },
      });
      existingTargetDomains.add(targetDomain);
      steps.push({
        status: 'applied',
        sourceSiteId: site.id,
        targetSiteId: created.id,
        title: `复制站点 ${site.name}`,
        description: `已创建目标环境 draft 站点 ${targetDomain}`,
        metadata: baseMetadata,
      });
    }

    const result = {
      projectId: dto.projectId,
      sourceEnvironment: { id: source.id, key: source.key, name: source.name },
      targetEnvironment: { id: target.id, key: target.key, name: target.name },
      dryRun,
      status: dryRun ? 'planned' : 'completed',
      plannedCount: steps.filter((step) => step.status === 'planned').length,
      appliedCount: steps.filter((step) => step.status === 'applied').length,
      skippedCount: steps.filter((step) => step.status === 'skipped').length,
      steps,
      warnings: [
        '只复制 Site 配置骨架并创建 draft 站点，不执行 Nginx/OpenResty 同步。',
        '不会复制 serverId、proxyConfigId、证书观测资产、续期状态或真实 TLS 证书内容。',
        '非 dry-run 时每个待复制站点必须显式提供目标域名。',
      ],
    };

    await this.writeSiteCopyAudit(teamId, userId, result);
    return result;
  }

  async getCdnConfigCopyAccessScope(teamId: string, dto: CopyProjectEnvironmentCdnConfigsDto) {
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    return {
      projectId: source.projectId,
      sourceEnvironmentId: source.id,
      targetEnvironmentId: target.id,
    };
  }

  async copyCdnConfigs(teamId: string, userId: string, dto: CopyProjectEnvironmentCdnConfigsDto) {
    if (!dto.projectId || !dto.sourceEnvironmentId || !dto.targetEnvironmentId) {
      throw new BadRequestException('projectId、sourceEnvironmentId 和 targetEnvironmentId 不能为空');
    }

    const dryRun = dto.dryRun !== false;
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    if (source.id === target.id) {
      throw new BadRequestException('源环境和目标环境不能相同');
    }
    if (!dryRun && dto.confirmationText !== target.name && dto.confirmationText !== target.key) {
      throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${target.name} / ${target.key}`);
    }

    const sourceConfigs = await this.prisma.cDNConfig.findMany({
      where: {
        teamId,
        projectId: dto.projectId,
        environmentId: source.id,
        ...(dto.cdnConfigIds?.length ? { id: { in: dto.cdnConfigIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        domain: true,
        origin: true,
        provider: true,
        credentialId: true,
        cacheRules: true,
        status: true,
      },
      orderBy: [{ name: 'asc' }, { domain: 'asc' }],
    });
    const targetConfigs = await this.prisma.cDNConfig.findMany({
      where: { teamId, projectId: dto.projectId, environmentId: target.id },
      select: { id: true, domain: true },
    });
    const existingTargetDomains = new Set(targetConfigs.map((config) => config.domain));
    const targetDomainOverrides = dto.targetDomainOverrides || {};
    const targetOriginOverrides = dto.targetOriginOverrides || {};
    const targetCredentialIds = dto.targetCredentialIds || {};
    const steps: EnvironmentCdnConfigCopyStep[] = [];

    for (const config of sourceConfigs) {
      const targetDomain = targetDomainOverrides[config.id]?.trim();
      const targetOrigin = targetOriginOverrides[config.id]?.trim();
      const targetCredentialId = targetCredentialIds[config.id]?.trim();
      const baseMetadata = {
        provider: config.provider,
        sourceDomain: config.domain,
        sourceOrigin: config.origin,
        targetDomain: targetDomain || null,
        targetOrigin: targetOrigin || null,
        targetCredentialId: targetCredentialId || null,
      };

      if (!targetDomain) {
        steps.push({
          status: 'skipped',
          sourceCdnConfigId: config.id,
          title: `CDN ${config.name}`,
          description: '缺少目标域名，apply 时不会自动复制该 CDN 配置',
          metadata: { ...baseMetadata, reason: 'missing_target_domain' },
        });
        continue;
      }
      if (!targetOrigin) {
        steps.push({
          status: 'skipped',
          sourceCdnConfigId: config.id,
          title: `CDN ${config.name}`,
          description: '缺少目标源站，apply 时不会自动复制该 CDN 配置',
          metadata: { ...baseMetadata, reason: 'missing_target_origin' },
        });
        continue;
      }
      if (!targetCredentialId) {
        steps.push({
          status: 'skipped',
          sourceCdnConfigId: config.id,
          title: `CDN ${config.name}`,
          description: '缺少目标云凭据，apply 时不会自动复制该 CDN 配置',
          metadata: { ...baseMetadata, reason: 'missing_target_credential' },
        });
        continue;
      }
      if (existingTargetDomains.has(targetDomain)) {
        steps.push({
          status: 'skipped',
          sourceCdnConfigId: config.id,
          title: `CDN ${config.name}`,
          description: `目标环境已存在 CDN 域名 ${targetDomain}`,
          metadata: { ...baseMetadata, reason: 'target_domain_exists' },
        });
        continue;
      }

      if (dryRun) {
        steps.push({
          status: 'planned',
          sourceCdnConfigId: config.id,
          title: `复制 CDN ${config.name}`,
          description: `将以 pending CDN 配置复制到 ${target.name}，目标域名 ${targetDomain}`,
          metadata: baseMetadata,
        });
        continue;
      }

      const created = await this.prisma.cDNConfig.create({
        data: {
          teamId,
          createdById: userId,
          projectId: dto.projectId,
          environmentId: target.id,
          credentialId: targetCredentialId,
          name: `${config.name} (${target.name})`,
          domain: targetDomain,
          origin: targetOrigin,
          provider: config.provider,
          cacheRules: config.cacheRules ? this.toJsonValue(config.cacheRules) : undefined,
          status: 'pending',
        },
        select: { id: true },
      });
      existingTargetDomains.add(targetDomain);
      steps.push({
        status: 'applied',
        sourceCdnConfigId: config.id,
        targetCdnConfigId: created.id,
        title: `复制 CDN ${config.name}`,
        description: `已创建目标环境 pending CDN 配置 ${targetDomain}`,
        metadata: baseMetadata,
      });
    }

    const result = {
      projectId: dto.projectId,
      sourceEnvironment: { id: source.id, key: source.key, name: source.name },
      targetEnvironment: { id: target.id, key: target.key, name: target.name },
      dryRun,
      status: dryRun ? 'planned' : 'completed',
      plannedCount: steps.filter((step) => step.status === 'planned').length,
      appliedCount: steps.filter((step) => step.status === 'applied').length,
      skippedCount: steps.filter((step) => step.status === 'skipped').length,
      steps,
      warnings: [
        '只复制 CDN 配置骨架并创建 pending 配置，不调用云 provider API、不执行刷新或同步。',
        '不会复制 providerData、syncError，也不会读取或复用源环境凭据值。',
        '非 dry-run 时每个待复制 CDN 必须显式提供目标域名、目标源站和目标 credentialId。',
      ],
    };

    await this.writeCdnConfigCopyAudit(teamId, userId, result);
    return result;
  }

  async getResourceCopyAccessScope(teamId: string, dto: CopyProjectEnvironmentResourcesDto) {
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    return {
      projectId: source.projectId,
      sourceEnvironmentId: source.id,
      targetEnvironmentId: target.id,
    };
  }

  async copyResources(teamId: string, userId: string, dto: CopyProjectEnvironmentResourcesDto) {
    if (!dto.projectId || !dto.sourceEnvironmentId || !dto.targetEnvironmentId) {
      throw new BadRequestException('projectId、sourceEnvironmentId 和 targetEnvironmentId 不能为空');
    }

    const dryRun = dto.dryRun !== false;
    const source = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.sourceEnvironmentId);
    const target = await this.resolveProjectEnvironment(teamId, dto.projectId, dto.targetEnvironmentId);
    if (source.id === target.id) {
      throw new BadRequestException('源环境和目标环境不能相同');
    }
    if (!dryRun && dto.confirmationText !== target.name && dto.confirmationText !== target.key) {
      throw new BadRequestException(`确认文本必须等于目标环境名称或 key：${target.name} / ${target.key}`);
    }

    const sourceResources = await this.prisma.managedResource.findMany({
      where: {
        teamId,
        projectId: dto.projectId,
        environmentId: source.id,
        ...(dto.managedResourceIds?.length ? { id: { in: dto.managedResourceIds } } : {}),
      },
      select: {
        id: true,
        sourceType: true,
        provider: true,
        kind: true,
        name: true,
        externalId: true,
        status: true,
        endpoint: true,
        serverId: true,
        credentialId: true,
      },
      orderBy: [{ name: 'asc' }, { externalId: 'asc' }],
    });
    const sourceSecrets = await this.prisma.secretKey.findMany({
      where: {
        teamId,
        projectId: dto.projectId,
        environmentId: source.id,
        ...(dto.secretKeyIds?.length ? { id: { in: dto.secretKeyIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
      },
      orderBy: [{ name: 'asc' }, { type: 'asc' }],
    });
    const targetResourceExternalIds = dto.targetResourceExternalIds || {};
    const targetResourceNames = dto.targetResourceNames || {};
    const targetResourceEndpoints = dto.targetResourceEndpoints || {};
    const targetResourceServerIds = dto.targetResourceServerIds || {};
    const targetResourceCredentialIds = dto.targetResourceCredentialIds || {};
    const targetSecretNames = dto.targetSecretNames || {};
    const targetSecretValues = dto.targetSecretValues || {};
    const targetSecretDescriptions = dto.targetSecretDescriptions || {};
    const requestedTargetExternalIds = Object.values(targetResourceExternalIds)
      .map((value) => value?.trim())
      .filter(Boolean);
    const existingResources = requestedTargetExternalIds.length
      ? await this.prisma.managedResource.findMany({
        where: { teamId, externalId: { in: requestedTargetExternalIds } },
        select: { sourceType: true, provider: true, externalId: true },
      })
      : [];
    const existingResourceKeys = new Set(
      existingResources.map((resource) => `${resource.sourceType}:${resource.provider}:${resource.externalId}`),
    );
    const existingTargetSecrets = await this.prisma.secretKey.findMany({
      where: { teamId, projectId: dto.projectId, environmentId: target.id },
      select: { name: true },
    });
    const existingTargetSecretNames = new Set(existingTargetSecrets.map((secret) => secret.name));
    const steps: EnvironmentResourceCopyStep[] = [];

    for (const resource of sourceResources) {
      const targetExternalId = targetResourceExternalIds[resource.id]?.trim();
      const targetName = targetResourceNames[resource.id]?.trim() || `${resource.name} (${target.name})`;
      const targetEndpoint = targetResourceEndpoints[resource.id]?.trim();
      const targetServerId = targetResourceServerIds[resource.id]?.trim();
      const targetCredentialId = targetResourceCredentialIds[resource.id]?.trim();
      const baseMetadata = {
        sourceType: resource.sourceType,
        provider: resource.provider,
        kind: resource.kind,
        sourceExternalId: resource.externalId,
        targetExternalId: targetExternalId || null,
        hasTargetServer: Boolean(targetServerId),
        hasTargetCredential: Boolean(targetCredentialId),
      };

      if (!targetExternalId) {
        steps.push({
          type: 'managed_resource',
          status: 'skipped',
          sourceId: resource.id,
          title: `资源 ${resource.name}`,
          description: '缺少目标 externalId，apply 时不会自动复制该资源索引',
          metadata: { ...baseMetadata, reason: 'missing_target_external_id' },
        });
        continue;
      }

      const resourceKey = `${resource.sourceType}:${resource.provider}:${targetExternalId}`;
      if (existingResourceKeys.has(resourceKey)) {
        steps.push({
          type: 'managed_resource',
          status: 'skipped',
          sourceId: resource.id,
          title: `资源 ${resource.name}`,
          description: `团队内已存在同 provider/sourceType 的 externalId ${targetExternalId}`,
          metadata: { ...baseMetadata, reason: 'target_external_id_exists' },
        });
        continue;
      }

      if (dryRun) {
        steps.push({
          type: 'managed_resource',
          status: 'planned',
          sourceId: resource.id,
          title: `复制资源 ${resource.name}`,
          description: `将以 unknown 状态复制到 ${target.name}，目标 externalId ${targetExternalId}`,
          metadata: baseMetadata,
        });
        existingResourceKeys.add(resourceKey);
        continue;
      }

      if (targetServerId) {
        await this.assertServer(teamId, targetServerId);
      }
      if (targetCredentialId) {
        await this.assertTeamCredential(teamId, targetCredentialId);
      }

      const created = await this.prisma.managedResource.create({
        data: {
          teamId,
          createdById: userId,
          projectId: dto.projectId,
          environmentId: target.id,
          serverId: targetServerId || undefined,
          credentialId: targetCredentialId || undefined,
          sourceType: resource.sourceType,
          provider: resource.provider,
          kind: resource.kind,
          name: targetName,
          externalId: targetExternalId,
          endpoint: targetEndpoint || undefined,
          status: 'unknown',
        },
        select: { id: true },
      });
      existingResourceKeys.add(resourceKey);
      steps.push({
        type: 'managed_resource',
        status: 'applied',
        sourceId: resource.id,
        targetId: created.id,
        title: `复制资源 ${resource.name}`,
        description: `已创建目标环境资源索引 ${targetExternalId}`,
        metadata: baseMetadata,
      });
    }

    for (const secret of sourceSecrets) {
      const targetName = targetSecretNames[secret.id]?.trim() || `${secret.name} (${target.name})`;
      const rawTargetValue = targetSecretValues[secret.id];
      const targetValue = typeof rawTargetValue === 'string' && rawTargetValue.length > 0
        ? rawTargetValue
        : undefined;
      const targetDescription =
        targetSecretDescriptions[secret.id] !== undefined
          ? targetSecretDescriptions[secret.id]
          : secret.description || undefined;
      const baseMetadata = {
        type: secret.type,
        sourceName: secret.name,
        targetName,
        hasTargetValue: Boolean(targetValue),
      };

      if (!targetValue) {
        steps.push({
          type: 'secret_key',
          status: 'skipped',
          sourceId: secret.id,
          title: `密钥 ${secret.name}`,
          description: '缺少目标密钥值，apply 时不会自动复制该密钥',
          metadata: { ...baseMetadata, reason: 'missing_target_secret_value' },
        });
        continue;
      }
      if (existingTargetSecretNames.has(targetName)) {
        steps.push({
          type: 'secret_key',
          status: 'skipped',
          sourceId: secret.id,
          title: `密钥 ${secret.name}`,
          description: `目标环境已存在同名密钥 ${targetName}`,
          metadata: { ...baseMetadata, reason: 'target_secret_name_exists' },
        });
        continue;
      }

      if (dryRun) {
        steps.push({
          type: 'secret_key',
          status: 'planned',
          sourceId: secret.id,
          title: `复制密钥 ${secret.name}`,
          description: `将以新提供的值复制到 ${target.name}`,
          metadata: baseMetadata,
        });
        existingTargetSecretNames.add(targetName);
        continue;
      }

      const created = await this.prisma.secretKey.create({
        data: {
          teamId,
          createdById: userId,
          projectId: dto.projectId,
          environmentId: target.id,
          name: targetName,
          type: secret.type,
          value: this.encryptSecretValue(targetValue),
          description: targetDescription,
        },
        select: { id: true },
      });
      existingTargetSecretNames.add(targetName);
      steps.push({
        type: 'secret_key',
        status: 'applied',
        sourceId: secret.id,
        targetId: created.id,
        title: `复制密钥 ${secret.name}`,
        description: `已创建目标环境密钥 ${targetName}`,
        metadata: { ...baseMetadata, hasTargetValue: true },
      });
    }

    const result = {
      projectId: dto.projectId,
      sourceEnvironment: { id: source.id, key: source.key, name: source.name },
      targetEnvironment: { id: target.id, key: target.key, name: target.name },
      dryRun,
      status: dryRun ? 'planned' : 'completed',
      plannedCount: steps.filter((step) => step.status === 'planned').length,
      appliedCount: steps.filter((step) => step.status === 'applied').length,
      skippedCount: steps.filter((step) => step.status === 'skipped').length,
      steps,
      warnings: [
        '只复制 ManagedResource 和 SecretKey 骨架，不创建或修改真实外部资源。',
        'ManagedResource 不复制 metadata、config、syncError、lastSyncAt、resourceInstanceId，也不会自动复用源 server/credential。',
        'SecretKey 不读取源密钥值；非 dry-run 时必须为每个目标密钥显式提供新 value，且审计 metadata 不记录该值。',
      ],
    };

    await this.writeResourceCopyAudit(teamId, userId, result);
    return result;
  }

  async listServers(teamId: string, environmentId: string) {
    const environment = await this.get(teamId, environmentId);

    return this.prisma.projectEnvironmentServer.findMany({
      where: { teamId, environmentId: environment.id, status: 'active' },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        server: { select: { id: true, name: true, host: true, status: true, services: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
      },
    });
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

    const binding = await this.prisma.projectEnvironmentServer.upsert({
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
        role: dto.role,
        metadata: dto.metadata ? this.toJsonValue(dto.metadata) : undefined,
      },
      update: {
        projectId: environment.projectId,
        role: dto.role,
        status: 'active',
        metadata: dto.metadata ? this.toJsonValue(dto.metadata) : undefined,
      },
      include: {
        server: { select: { id: true, name: true, host: true, status: true, services: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true, status: true } },
      },
    });

    await this.writeServerBindingAudit(teamId, userId, {
      projectId: environment.projectId,
      environmentId: environment.id,
      environmentName: environment.name,
      serverId: dto.serverId,
      serverName: binding.server.name,
      role: dto.role,
      action: 'bind',
      status: 'completed',
    });

    return binding;
  }

  async unbindServer(teamId: string, userId: string, environmentId: string, serverId: string) {
    const environment = await this.get(teamId, environmentId);
    const binding = await this.prisma.projectEnvironmentServer.findFirst({
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

    await this.prisma.projectEnvironmentServer.delete({ where: { id: binding.id } });
    await this.writeServerBindingAudit(teamId, userId, {
      projectId: environment.projectId,
      environmentId: environment.id,
      environmentName: environment.name,
      serverId,
      serverName: binding.server.name,
      role: binding.role,
      action: 'unbind',
      status: 'completed',
    });

    return { success: true };
  }

  async ensureDefaultsForProject(teamId: string, projectId: string, config: unknown) {
    const keys = this.environmentKeysFromConfig(config);

    for (const [index, key] of keys.entries()) {
      await this.prisma.projectEnvironment.upsert({
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
          name: this.labelForKey(key),
          sortOrder: index * 10,
          config: this.toJsonValue({
            source: 'project_config',
            initializedBy: 'ProjectEnvironmentService.ensureDefaultsForProject',
          }),
        },
        update: {
          name: this.labelForKey(key),
          sortOrder: index * 10,
          status: 'active',
        },
      });
    }
  }

  private async get(teamId: string, id: string) {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { id, teamId },
    });

    if (!environment) {
      throw new NotFoundException('项目环境不存在');
    }

    return environment;
  }

  private async assertProject(teamId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true, config: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在或不属于当前团队');
    }

    return project;
  }

  private async assertServer(teamId: string, serverId: string) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, teamId },
      select: { id: true },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在或不属于当前团队');
    }

    return server;
  }

  private async assertTeamCredential(teamId: string, credentialId: string) {
    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: credentialId, teamId },
      select: { id: true },
    });

    if (!credential) {
      throw new NotFoundException('凭据不存在或不属于当前团队');
    }

    return credential;
  }

  private async resolveProjectEnvironment(teamId: string, projectId: string, environmentId: string) {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { id: environmentId, teamId, projectId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true, status: true },
    });

    if (!environment) {
      throw new NotFoundException('项目环境不存在或不可用');
    }

    return environment;
  }

  private environmentKeysFromConfig(config: unknown) {
    const record = isRecord(config) ? config : {};
    const keys = readStringArray(record.environments)
      .map((key) => this.normalizeKey(key))
      .filter(Boolean);

    return keys.length > 0 ? [...new Set(keys)] : DEFAULT_PROJECT_ENVIRONMENT_KEYS;
  }

  private normalizeKey(value: string) {
    const key = value.trim().toLowerCase();
    if (!key) {
      throw new BadRequestException('环境 key 不能为空');
    }

    return key.replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
  }

  private labelForKey(key: string) {
    return ENVIRONMENT_LABELS[key] || key;
  }

  private sortOrderForKey(key: string) {
    const knownOrder = ['dev', 'test', 'staging', 'prod'].indexOf(key);
    return knownOrder >= 0 ? knownOrder * 10 : 100;
  }

  private groupByEnvironment<T extends { environmentId: string | null }>(items: T[]) {
    const grouped = new Map<string, T[]>();
    for (const item of items) {
      if (!item.environmentId) continue;
      const current = grouped.get(item.environmentId) || [];
      current.push(item);
      grouped.set(item.environmentId, current);
    }
    return grouped;
  }

  private buildDeployConfigCoverage(services: Array<{ deployConfig: unknown }>): DeployConfigCoverage {
    return {
      total: services.length,
      workingDirectory: services.filter((service) => this.readConfigString(service.deployConfig, 'workingDirectory')).length,
      buildCommand: services.filter((service) => this.readConfigString(service.deployConfig, 'buildCommand')).length,
      deployCommand: services.filter((service) => this.readConfigString(service.deployConfig, 'deployCommand')).length,
      healthCheckUrl: services.filter((service) => this.readConfigString(service.deployConfig, 'healthCheckUrl')).length,
      rollbackCommand: services.filter((service) => this.readConfigString(service.deployConfig, 'rollbackCommand')).length,
    };
  }

  private findReferenceProfile(
    profiles: EnvironmentSyncProfile[],
    referenceEnvironmentId?: string,
  ) {
    if (referenceEnvironmentId) {
      return profiles.find((profile) => profile.environment.id === referenceEnvironmentId) || null;
    }

    return (
      profiles.find((profile) => ['prod', 'production'].includes(profile.environment.key.toLowerCase())) ||
      profiles.find((profile) =>
        ['prod', 'production', '生产'].some((text) => profile.environment.name.toLowerCase().includes(text)),
      ) ||
      profiles[profiles.length - 1] ||
      null
    );
  }

  private buildSyncDifferences(
    profile: EnvironmentSyncProfile,
    reference: EnvironmentSyncProfile,
  ): EnvironmentSyncDifferences {
    if (profile.environment.id === reference.environment.id) {
      return this.emptySyncDifferences();
    }

    return {
      missing: {
        serverRoles: this.missingItems(profile.serverRoleKeys, reference.serverRoleKeys),
        services: this.missingItems(profile.serviceKeys, reference.serviceKeys),
        resourceKinds: this.missingItems(profile.resourceKindKeys, reference.resourceKindKeys),
        siteRuntimeTypes: this.missingItems(profile.siteRuntimeKeys, reference.siteRuntimeKeys),
        secretTypes: this.missingItems(profile.secretTypeKeys, reference.secretTypeKeys),
        cdnProviders: this.missingItems(profile.cdnProviderKeys, reference.cdnProviderKeys),
      },
      extra: {
        serverRoles: this.missingItems(reference.serverRoleKeys, profile.serverRoleKeys),
        services: this.missingItems(reference.serviceKeys, profile.serviceKeys),
        resourceKinds: this.missingItems(reference.resourceKindKeys, profile.resourceKindKeys),
        siteRuntimeTypes: this.missingItems(reference.siteRuntimeKeys, profile.siteRuntimeKeys),
        secretTypes: this.missingItems(reference.secretTypeKeys, profile.secretTypeKeys),
        cdnProviders: this.missingItems(reference.cdnProviderKeys, profile.cdnProviderKeys),
      },
      deployConfigGaps: DEPLOY_CONFIG_FIELDS
        .map((field) => ({
          field,
          missingCount: Math.max(0, reference.deployConfigCoverage[field] - profile.deployConfigCoverage[field]),
        }))
        .filter((gap) => gap.missingCount > 0),
      serviceBindingGapDelta: Math.max(0, profile.serviceBindingGapCount - reference.serviceBindingGapCount),
      tlsSiteGap: Math.max(0, reference.tlsSiteCount - profile.tlsSiteCount),
      successfulDeploymentGap: profile.successfulDeployments === 0 && reference.successfulDeployments > 0,
    };
  }

  private buildSyncSuggestionActions(
    profile: EnvironmentSyncProfile,
    reference: EnvironmentSyncProfile,
    differences: EnvironmentSyncDifferences,
  ): EnvironmentSyncSuggestionAction[] {
    const actions: EnvironmentSyncSuggestionAction[] = [];
    const metadataBase = {
      sourceEnvironmentId: reference.environment.id,
      targetEnvironmentId: profile.environment.id,
    };

    if (differences.missing.serverRoles.length > 0) {
      actions.push({
        kind: 'bind_server_role',
        severity: 'warning',
        title: `补齐服务器角色：${this.previewList(differences.missing.serverRoles)}`,
        description: '为目标环境绑定对应用途的服务器，后续部署、站点同步和资源采集才能按环境收敛。',
        target: 'resource-control',
        metadata: { ...metadataBase, roles: differences.missing.serverRoles },
      });
    }

    if (differences.missing.services.length > 0) {
      actions.push({
        kind: 'create_missing_service',
        severity: 'warning',
        title: `补齐应用服务：${this.previewList(differences.missing.services)}`,
        description: '为目标环境创建同名服务或声明该环境无需部署，避免仅生产环境有服务定义。',
        target: 'applications',
        metadata: { ...metadataBase, services: differences.missing.services },
      });
    }

    if (differences.deployConfigGaps.length > 0) {
      actions.push({
        kind: 'complete_deploy_config',
        severity: 'warning',
        title: `补齐部署配置：${this.previewList(differences.deployConfigGaps.map((gap) => DEPLOY_CONFIG_FIELD_LABELS[gap.field] || gap.field))}`,
        description: '补齐工作目录、构建、部署、健康检查或回滚命令后，该环境才能接入构建部署。',
        target: 'applications',
        metadata: { ...metadataBase, gaps: differences.deployConfigGaps },
      });
    }

    if (differences.serviceBindingGapDelta > 0) {
      actions.push({
        kind: 'bind_service_runtime',
        severity: 'warning',
        title: `补齐运行绑定：${differences.serviceBindingGapDelta} 个服务缺口`,
        description: '为服务绑定服务器、站点或托管资源，避免部署计划生成后找不到运行目标。',
        target: 'applications',
        metadata: { ...metadataBase, gapCount: differences.serviceBindingGapDelta },
      });
    }

    if (differences.missing.resourceKinds.length > 0) {
      actions.push({
        kind: 'bind_resource_kind',
        severity: 'warning',
        title: `补齐资源类型：${this.previewList(differences.missing.resourceKinds)}`,
        description: '把目标环境实际使用的 Docker、数据库、日志或对象存储资源绑定到项目环境。',
        target: 'resource-control',
        metadata: { ...metadataBase, resourceKinds: differences.missing.resourceKinds },
      });
    }

    if (differences.missing.siteRuntimeTypes.length > 0) {
      actions.push({
        kind: 'create_site_runtime',
        severity: 'info',
        title: `补齐站点运行时：${this.previewList(differences.missing.siteRuntimeTypes)}`,
        description: '为目标环境创建相同类型的站点入口，并按环境配置域名、TLS 和源站。',
        target: 'sites',
        metadata: { ...metadataBase, runtimeTypes: differences.missing.siteRuntimeTypes },
      });
    }

    if (differences.missing.cdnProviders.length > 0) {
      actions.push({
        kind: 'create_cdn_config',
        severity: 'info',
        title: `补齐 CDN：${this.previewList(differences.missing.cdnProviders)}`,
        description: '为目标环境创建或绑定同类 CDN 配置，避免域名加速只覆盖部分环境。',
        target: 'cdn-configs',
        metadata: { ...metadataBase, providers: differences.missing.cdnProviders },
      });
    }

    if (differences.missing.secretTypes.length > 0) {
      actions.push({
        kind: 'create_secret_type',
        severity: 'warning',
        title: `补齐密钥类型：${this.previewList(differences.missing.secretTypes)}`,
        description: '为目标环境创建对应类型密钥，后续才能安全注入服务配置。',
        target: 'keys',
        metadata: { ...metadataBase, secretTypes: differences.missing.secretTypes },
      });
    }

    if (differences.tlsSiteGap > 0) {
      actions.push({
        kind: 'enable_site_tls',
        severity: 'info',
        title: `补齐 TLS 站点：${differences.tlsSiteGap} 个`,
        description: '检查目标环境站点的 TLS 配置，避免生产以外环境缺少证书探测和续期治理。',
        target: 'sites',
        metadata: { ...metadataBase, gapCount: differences.tlsSiteGap },
      });
    }

    if (differences.successfulDeploymentGap) {
      actions.push({
        kind: 'run_deployment',
        severity: 'info',
        title: '补一次成功部署记录',
        description: '目标环境还没有成功部署记录，可先生成 dry-run 或队列化部署计划验证链路。',
        target: 'applications',
        metadata: metadataBase,
      });
    }

    return actions.slice(0, 10);
  }

  private buildDifferenceLabels(differences: EnvironmentSyncDifferences) {
    const labels: string[] = [];
    this.addMissingExtraLabels(labels, '服务器角色', differences.missing.serverRoles, differences.extra.serverRoles);
    this.addMissingExtraLabels(labels, '服务', differences.missing.services, differences.extra.services);
    this.addMissingExtraLabels(labels, '资源类型', differences.missing.resourceKinds, differences.extra.resourceKinds);
    this.addMissingExtraLabels(labels, '站点运行时', differences.missing.siteRuntimeTypes, differences.extra.siteRuntimeTypes);
    this.addMissingExtraLabels(labels, 'CDN', differences.missing.cdnProviders, differences.extra.cdnProviders);
    this.addMissingExtraLabels(labels, '密钥类型', differences.missing.secretTypes, differences.extra.secretTypes);

    for (const gap of differences.deployConfigGaps) {
      labels.push(`${DEPLOY_CONFIG_FIELD_LABELS[gap.field] || gap.field}少 ${gap.missingCount}`);
    }
    if (differences.serviceBindingGapDelta > 0) {
      labels.push(`运行绑定缺口多 ${differences.serviceBindingGapDelta}`);
    }
    if (differences.tlsSiteGap > 0) {
      labels.push(`TLS 站点少 ${differences.tlsSiteGap}`);
    }
    if (differences.successfulDeploymentGap) {
      labels.push('缺成功部署');
    }

    return labels.slice(0, 12);
  }

  private addMissingExtraLabels(labels: string[], label: string, missing: string[], extra: string[]) {
    if (missing.length > 0) {
      labels.push(`${label}少 ${this.previewList(missing, 2)}`);
    }
    if (extra.length > 0) {
      labels.push(`${label}多 ${this.previewList(extra, 2)}`);
    }
  }

  private emptySyncDifferences(): EnvironmentSyncDifferences {
    return {
      missing: {
        serverRoles: [],
        services: [],
        resourceKinds: [],
        siteRuntimeTypes: [],
        secretTypes: [],
        cdnProviders: [],
      },
      extra: {
        serverRoles: [],
        services: [],
        resourceKinds: [],
        siteRuntimeTypes: [],
        secretTypes: [],
        cdnProviders: [],
      },
      deployConfigGaps: [],
      serviceBindingGapDelta: 0,
      tlsSiteGap: 0,
      successfulDeploymentGap: false,
    };
  }

  private missingItems(current: string[], reference: string[]) {
    return reference.filter((item) => !current.includes(item));
  }

  private applicationServiceSyncKey(applicationId: string, serviceName: string) {
    return `${applicationId}:${serviceName.trim().toLowerCase()}`;
  }

  private safeDeployConfig(config: unknown): Partial<Record<DeployConfigField, string>> {
    const record = this.recordFromJson(config);
    const safe: Partial<Record<DeployConfigField, string>> = {};

    for (const field of DEPLOY_CONFIG_FIELDS) {
      const value = this.readConfigString(record, field);
      if (value) {
        safe[field] = value;
      }
    }

    return safe;
  }

  private recordFromJson(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
  }

  private skippedServiceBindings(service: {
    serverId?: string | null;
    siteId?: string | null;
    managedResourceId?: string | null;
  }) {
    return {
      server: Boolean(service.serverId),
      site: Boolean(service.siteId),
      managedResource: Boolean(service.managedResourceId),
      env: true,
      secretKeyIds: true,
    };
  }

  private normalizeResourceBindingTypes(types?: string[]) {
    const allowed = new Set(DEFAULT_RESOURCE_BINDING_TYPES);
    const requested = (types || [])
      .filter((type): type is EnvironmentResourceBindingType => allowed.has(type as EnvironmentResourceBindingType));
    return new Set(requested.length > 0 ? requested : DEFAULT_RESOURCE_BINDING_TYPES);
  }

  private resourceBindingStep(
    type: EnvironmentResourceBindingType,
    status: EnvironmentResourceBindingStep['status'],
    resourceId: string,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): EnvironmentResourceBindingStep {
    return {
      type,
      status,
      resourceId,
      title,
      description,
      metadata,
    };
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
      updates.push(this.prisma.managedResource.updateMany({
        where: { teamId, projectId, environmentId: null, id: { in: ids.managedResourceIds } },
        data: { environmentId },
      }));
    }
    if (ids.resourceInstanceIds.length > 0) {
      updates.push(this.prisma.resourceInstance.updateMany({
        where: { teamId, projectId, environmentId: null, id: { in: ids.resourceInstanceIds } },
        data: { environmentId },
      }));
    }
    if (ids.siteIds.length > 0) {
      updates.push(this.prisma.site.updateMany({
        where: { teamId, projectId, environmentId: null, id: { in: ids.siteIds } },
        data: { environmentId },
      }));
    }
    if (ids.cdnConfigIds.length > 0) {
      updates.push(this.prisma.cDNConfig.updateMany({
        where: { teamId, projectId, environmentId: null, id: { in: ids.cdnConfigIds } },
        data: { environmentId },
      }));
    }
    if (ids.secretKeyIds.length > 0) {
      updates.push(this.prisma.secretKey.updateMany({
        where: { teamId, projectId, environmentId: null, id: { in: ids.secretKeyIds } },
        data: { environmentId },
      }));
    }

    await Promise.all(updates);
  }

  private uniqueSorted(items: string[]) {
    return Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }

  private previewList(items: string[], max = 3) {
    if (items.length === 0) {
      return '无';
    }
    const preview = items.slice(0, max).join('、');
    return items.length > max ? `${preview} 等 ${items.length} 项` : preview;
  }

  private readConfigString(config: unknown, key: string) {
    const record = isRecord(config) ? config : {};
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private siteTlsEnabled(tls: unknown) {
    if (!isRecord(tls)) {
      return false;
    }
    return tls.enabled === true || (typeof tls.type === 'string' && tls.type !== 'none');
  }

  private sanitizeSiteTlsForCopy(tls: unknown) {
    if (!isRecord(tls)) {
      return {};
    }

    const sanitized: Record<string, unknown> = {};
    ['enabled', 'type', 'email', 'redirectHttp', 'hsts', 'http2'].forEach((key) => {
      if (tls[key] !== undefined) {
        sanitized[key] = tls[key];
      }
    });
    return sanitized;
  }

  private async writeSyncApplyAudit(
    teamId: string,
    userId: string,
    result: {
      projectId: string;
      sourceEnvironment: { id: string; key: string; name: string };
      targetEnvironment: { id: string; key: string; name: string };
      dryRun: boolean;
      status: string;
      plannedCount: number;
      appliedCount: number;
      skippedCount: number;
      steps: EnvironmentSyncApplyStep[];
      warnings: string[];
    },
  ) {
    if (!this.auditEventService) {
      return;
    }

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: result.projectId,
      environmentId: result.targetEnvironment.id,
      category: 'project_environment',
      action: 'project_environment.sync_suggestions.apply',
      targetType: 'project_environment',
      targetId: result.targetEnvironment.id,
      risk: result.dryRun ? 'low' : 'medium',
      status: result.status,
      summary: result.dryRun
        ? `生成环境同步计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`
        : `应用环境同步计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`,
      metadata: {
        sourceEnvironment: result.sourceEnvironment,
        targetEnvironment: result.targetEnvironment,
        dryRun: result.dryRun,
        plannedCount: result.plannedCount,
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
        stepKinds: result.steps.map((step) => ({ kind: step.kind, status: step.status })),
        warnings: result.warnings,
      },
    });
  }

  private async writeSiteCopyAudit(
    teamId: string,
    userId: string,
    result: {
      projectId: string;
      sourceEnvironment: { id: string; key: string; name: string };
      targetEnvironment: { id: string; key: string; name: string };
      dryRun: boolean;
      status: string;
      plannedCount: number;
      appliedCount: number;
      skippedCount: number;
      steps: EnvironmentSiteCopyStep[];
      warnings: string[];
    },
  ) {
    if (!this.auditEventService) {
      return;
    }

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: result.projectId,
      environmentId: result.targetEnvironment.id,
      category: 'project_environment',
      action: 'project_environment.sites.copy',
      targetType: 'project_environment',
      targetId: result.targetEnvironment.id,
      risk: result.dryRun ? 'low' : 'medium',
      status: result.status,
      summary: result.dryRun
        ? `生成跨环境站点复制计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`
        : `应用跨环境站点复制：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`,
      metadata: {
        sourceEnvironment: result.sourceEnvironment,
        targetEnvironment: result.targetEnvironment,
        dryRun: result.dryRun,
        plannedCount: result.plannedCount,
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
        stepStatus: result.steps.map((step) => ({
          sourceSiteId: step.sourceSiteId,
          targetSiteId: step.targetSiteId || null,
          status: step.status,
        })),
        warnings: result.warnings,
      },
    });
  }

  private async writeCdnConfigCopyAudit(
    teamId: string,
    userId: string,
    result: {
      projectId: string;
      sourceEnvironment: { id: string; key: string; name: string };
      targetEnvironment: { id: string; key: string; name: string };
      dryRun: boolean;
      status: string;
      plannedCount: number;
      appliedCount: number;
      skippedCount: number;
      steps: EnvironmentCdnConfigCopyStep[];
      warnings: string[];
    },
  ) {
    if (!this.auditEventService) {
      return;
    }

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: result.projectId,
      environmentId: result.targetEnvironment.id,
      category: 'project_environment',
      action: 'project_environment.cdn_configs.copy',
      targetType: 'project_environment',
      targetId: result.targetEnvironment.id,
      risk: result.dryRun ? 'low' : 'medium',
      status: result.status,
      summary: result.dryRun
        ? `生成跨环境 CDN 配置复制计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`
        : `应用跨环境 CDN 配置复制：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`,
      metadata: {
        sourceEnvironment: result.sourceEnvironment,
        targetEnvironment: result.targetEnvironment,
        dryRun: result.dryRun,
        plannedCount: result.plannedCount,
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
        stepStatus: result.steps.map((step) => ({
          sourceCdnConfigId: step.sourceCdnConfigId,
          targetCdnConfigId: step.targetCdnConfigId || null,
          status: step.status,
        })),
        warnings: result.warnings,
      },
    });
  }

  private async writeResourceCopyAudit(
    teamId: string,
    userId: string,
    result: {
      projectId: string;
      sourceEnvironment: { id: string; key: string; name: string };
      targetEnvironment: { id: string; key: string; name: string };
      dryRun: boolean;
      status: string;
      plannedCount: number;
      appliedCount: number;
      skippedCount: number;
      steps: EnvironmentResourceCopyStep[];
      warnings: string[];
    },
  ) {
    if (!this.auditEventService) {
      return;
    }

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: result.projectId,
      environmentId: result.targetEnvironment.id,
      category: 'project_environment',
      action: 'project_environment.resources.copy',
      targetType: 'project_environment',
      targetId: result.targetEnvironment.id,
      risk: result.dryRun ? 'low' : 'medium',
      status: result.status,
      summary: result.dryRun
        ? `生成跨环境资源/密钥复制计划：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`
        : `应用跨环境资源/密钥复制：${result.sourceEnvironment.name} -> ${result.targetEnvironment.name}`,
      metadata: {
        sourceEnvironment: result.sourceEnvironment,
        targetEnvironment: result.targetEnvironment,
        dryRun: result.dryRun,
        plannedCount: result.plannedCount,
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
        stepStatus: result.steps.map((step) => ({
          type: step.type,
          sourceId: step.sourceId,
          targetId: step.targetId || null,
          status: step.status,
        })),
        warnings: result.warnings,
      },
    });
  }

  private async writeResourceBulkBindingAudit(
    teamId: string,
    userId: string,
    result: {
      projectId: string;
      environment: { id: string; key: string; name: string };
      dryRun: boolean;
      status: string;
      plannedCount: number;
      appliedCount: number;
      skippedCount: number;
      steps: EnvironmentResourceBindingStep[];
      summary: Record<string, number>;
      warnings: string[];
    },
  ) {
    if (!this.auditEventService) {
      return;
    }

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: result.projectId,
      environmentId: result.environment.id,
      category: 'project_environment',
      action: 'project_environment.resources.bulk_bind',
      targetType: 'project_environment',
      targetId: result.environment.id,
      risk: result.dryRun ? 'low' : 'medium',
      status: result.status,
      summary: result.dryRun
        ? `生成环境资源批量绑定计划：${result.environment.name}`
        : `应用环境资源批量绑定：${result.environment.name}`,
      metadata: {
        dryRun: result.dryRun,
        plannedCount: result.plannedCount,
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
        summary: result.summary,
        stepTypes: result.steps.map((step) => ({ type: step.type, status: step.status })),
        warnings: result.warnings,
      },
    });
  }

  private async writeServerBindingAudit(
    teamId: string,
    userId: string,
    input: {
      projectId: string;
      environmentId: string;
      environmentName: string;
      serverId: string;
      serverName: string;
      role?: string | null;
      action: 'bind' | 'unbind';
      status: string;
    },
  ) {
    if (!this.auditEventService) {
      return;
    }

    const bindingAction = input.action === 'bind'
      ? 'project_environment.server.bind'
      : 'project_environment.server.unbind';

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      serverId: input.serverId,
      category: 'project_environment',
      action: bindingAction,
      targetType: 'project_environment_server',
      targetId: input.serverId,
      risk: 'medium',
      status: input.status,
      summary: input.action === 'bind'
        ? `绑定服务器 ${input.serverName} 到环境 ${input.environmentName}`
        : `解绑环境 ${input.environmentName} 的服务器 ${input.serverName}`,
      metadata: {
        environmentName: input.environmentName,
        serverName: input.serverName,
        role: input.role || null,
      },
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
