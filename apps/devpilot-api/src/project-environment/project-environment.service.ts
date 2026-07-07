import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { SiteService } from '../site';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import {
  labelForKey as labelForKeyUtil,
  normalizeKey as normalizeKeyUtil,
  sortOrderForKey as sortOrderForKeyUtil,
  toJsonValue as toJsonValueUtil,
} from './project-environment-helpers.utils';
import {
  buildSiteCopyAuditInput,
} from './project-environment-audit.utils';
import { ProjectEnvironmentCopySiteService } from './project-environment-copy-site.service';
import { ProjectEnvironmentSyncService } from './project-environment-sync.service';
import { ProjectEnvironmentSyncApplyService } from './project-environment-sync-apply.service';
import { ProjectEnvironmentResourceCopyService } from './project-environment-resource-copy.service';
import { ProjectEnvironmentCdnCopyService } from './project-environment-cdn-copy.service';
import { ProjectEnvironmentBulkBindService } from './project-environment-bulk-bind.service';
import { ProjectEnvironmentDefaultsService } from './project-environment-defaults.service';
import { ProjectEnvironmentServerBindingService } from './project-environment-server-binding.service';
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
    private readonly bulkBindService: ProjectEnvironmentBulkBindService,
    private readonly defaultsService: ProjectEnvironmentDefaultsService,
    private readonly serverBindingService: ProjectEnvironmentServerBindingService,
    @Optional()
    private readonly auditEventService: AuditEventService,
    @Optional()
    private readonly siteService: SiteService,
  ) {}

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


  getResourceBulkBindingAccessScope = (teamId: string, dto: BulkBindProjectEnvironmentResourcesDto) =>
    this.bulkBindService.getResourceBulkBindingAccessScope(teamId, dto);

  bulkBindResources = (teamId: string, userId: string, dto: BulkBindProjectEnvironmentResourcesDto) =>
    this.bulkBindService.bulkBindResources(teamId, userId, dto);

  getCdnConfigCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentCdnConfigsDto) =>
    this.cdnCopyService.getCdnConfigCopyAccessScope(teamId, dto);

  copyCdnConfigs = (teamId: string, userId: string, dto: CopyProjectEnvironmentCdnConfigsDto) =>
    this.cdnCopyService.copyCdnConfigs(teamId, userId, dto);

  getResourceCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentResourcesDto) =>
    this.resourceCopyService.getResourceCopyAccessScope(teamId, dto);

  copyResources = (teamId: string, userId: string, dto: CopyProjectEnvironmentResourcesDto) =>
    this.resourceCopyService.copyResources(teamId, userId, dto);

  listServers = (teamId: string, environmentId: string) =>
    this.serverBindingService.listServers(teamId, environmentId);

  getAccessScope = (teamId: string, environmentId: string) =>
    this.serverBindingService.getAccessScope(teamId, environmentId);

  bindServer = (teamId: string, userId: string, environmentId: string, dto: BindProjectEnvironmentServerDto) =>
    this.serverBindingService.bindServer(teamId, userId, environmentId, dto);

  unbindServer = (teamId: string, userId: string, environmentId: string, serverId: string) =>
    this.serverBindingService.unbindServer(teamId, userId, environmentId, serverId);

  ensureDefaultsForProject = (teamId: string, projectId: string, config: unknown) =>
    this.defaultsService.ensureDefaultsForProject(teamId, projectId, config);

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

  getSiteCopyAccessScope = (teamId: string, dto: CopyProjectEnvironmentSitesDto) =>
    this.copySiteService.getSiteCopyAccessScope(teamId, dto);
  copySites = (teamId: string, userId: string, dto: CopyProjectEnvironmentSitesDto) =>
    this.copySiteService.copySites(teamId, userId, dto);
}
