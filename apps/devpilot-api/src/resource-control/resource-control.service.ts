import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { ServerCommandStep, ServerExecutionResult, ServerExecutorService } from '../server-executor';
import {
  getActionDefinition,
  getActionsForResource,
  isActionSupported,
  ResourceActionDefinition,
  RESOURCE_ACTIONS,
} from './actions/resource-actions';
import { DefaultCredentialResolver, ResolvedCredentialRef } from './credentials/credential-resolver';
import {
  ExecuteResourceActionDto,
  ListResourceActionRunsQueryDto,
  ListResourceConnectionRunsQueryDto,
  ListResourceMetricSeriesQueryDto,
  ListResourceMetricSnapshotsQueryDto,
  ListResourceMetricTrendsQueryDto,
  ListResourceQueryRunsQueryDto,
  ListResourceActionsQueryDto,
  ListManagedResourcesQueryDto,
  ProbeResourceConnectionDto,
  RunResourceQueryDto,
  SyncCloudResourcesDto,
  SyncServerDockerDto,
  UpdateManagedResourceBindingDto,
} from './dto/resource-control.dto';
import {
  buildManagedResourceWhere,
  buildResourceActionRunWhere,
  buildResourceConnectionRunWhere,
  buildResourceMetricSnapshotWhere,
  buildResourceQueryRunWhere,
} from './resource-control-query.utils';
import { DirectDbQueryExecutor } from './executors/direct-db-query.executor';
import { ResourceExecutorRouter } from './executors/executor-router';
import { buildDockerStatsMetricSnapshotInputs } from './metrics/docker-stats-metrics';
import {
  buildDockerInventorySeedsFromDockerPs,
  buildDockerInventorySeedsFromRecords,
  DOCKER_INVENTORY_ADAPTER_KEY,
  DOCKER_PS_JSON_COMMAND,
} from './inventory/docker-inventory';
import { DockerInventoryExecutorFactory } from './inventory/executors/docker-inventory-executor.factory';
import { CloudInventoryProvider } from './inventory/cloud-inventory';
import { CloudProviderInventoryService } from './inventory/cloud-provider-inventory.service';
import { ResourceControlCapabilitiesService } from './resource-control-capabilities.service';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlListReadService } from './resource-control-list-read.service';
import { ResourceControlBindingService } from './resource-control-binding.service';
import { ResourceControlConnectionSharedService } from './resource-control-connection-shared.service';
import { ResourceControlConnectionProbeService } from './resource-control-connection-probe.service';
import { ResourceControlResourceQueryService } from './resource-control-query.service';
import { ResourceControlActionService } from './resource-control-action.service';
import { ResourceControlMetricsService } from './resource-control-metrics.service';
import {
  actionRunInclude,
  connectionRunInclude,
  managedResourceInclude,
  metricSnapshotInclude,
  queryRunInclude,
} from './resource-control-includes.constants';
import { ResourceControlCloudProviderHealthService } from './resource-control-cloud-provider-health.service';
import { CloudProviderHealthRun } from './resource-control-cloud-provider-health.types';
import { asPositiveInt, asRecord, asString } from './resource-control-value.utils';
import {
  allowedQueryTypes,
  isDirectQueryCredentialType,
  normalizeResourceQuery as normalizeResourceQueryUtil,
  requiresDirectQueryCredential,
  requiresResourceApproval as requiresResourceApprovalUtil,
  resolveQueryExecutionShape as resolveQueryExecutionShapeUtil,
  resolveQueryType as resolveQueryTypeUtil,
  toJsonValue as toJsonValueUtil,
} from './resource-control-query-type.utils';
import {
  parseMetricSeriesLimit as parseMetricSeriesLimitUtil,
  parseMetricSeriesMetric as parseMetricSeriesMetricUtil,
  parseMetricTrendWindowMinutes as parseMetricTrendWindowMinutesUtil,
  metricSeriesValue as metricSeriesValueUtil,
  summarizeMetricNumber as summarizeMetricNumberUtil,
  RESOURCE_METRIC_SERIES_FIELDS,
  type ResourceMetricSeriesMetric,
} from './resource-control-metrics.utils';
import {
  canExecuteDirectDbLiveQuery as canExecuteDirectDbLiveQueryUtil,
  hasForbiddenSqlReadonlyPattern as hasForbiddenSqlReadonlyPatternUtil,
  isLiveQueryConfirmed as isLiveQueryConfirmedUtil,
  maskQueryPreviewRow as maskQueryPreviewRowUtil,
  queryResultContract as queryResultContractUtil,
  stripSqlComments as stripSqlCommentsUtil,
  validateReadOnlyQuery as validateReadOnlyQueryUtil,
} from './resource-control-query-validation.utils';
import { buildConnectionTarget as buildConnectionTargetUtil } from './resource-control-connection-probe.utils';
import {
  buildMetricSeries as buildMetricSeriesUtil,
  summarizeMetricTrends as summarizeMetricTrendsUtil,
} from './resource-control-metric-summary.utils';

type ManagedResourceSeed = {
  sourceType: string;
  provider: string;
  kind: string;
  name: string;
  externalId: string;
  status: string;
  endpoint?: string;
  serverId?: string;
  projectId?: string;
  environmentId?: string;
  credentialId?: string;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

type ServerInventorySource = {
  id: string;
  name: string;
  host: string;
  status: string;
  services: Prisma.JsonValue | null;
};

type EnvironmentRef = {
  id: string;
  projectId: string;
  key: string;
  name: string;
};

type ManagedResourceForConnection = {
  id: string;
  sourceType: string;
  provider: string;
  kind: string;
  name: string;
  externalId: string;
  status: string;
  endpoint: string | null;
  projectId: string | null;
  environmentId: string | null;
  serverId: string | null;
  credentialId: string | null;
  config: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
};

type ResourceConnectionExecutionResult = {
  status: 'completed' | 'failed' | 'blocked' | 'cancelled';
  executorKey: string;
  adapterKey: string;
  authAdapterKey: string;
  connectionPlan?: Prisma.InputJsonValue;
  result?: Prisma.InputJsonValue;
  error?: string;
};

type ResourceQueryExecutionResult = {
  status: 'completed' | 'failed' | 'blocked' | 'cancelled';
  executorKey: string;
  adapterKey: string;
  authAdapterKey: string;
  queryPlan?: Prisma.InputJsonValue;
  result?: Prisma.InputJsonValue;
  error?: string;
};

type MetricTrendResourceRef = {
  id: string;
  projectId: string | null;
  environmentId: string | null;
  name: string;
  provider: string;
  kind: string;
  sourceType: string;
  endpoint: string | null;
};

type ResourceMetricSnapshotForTrend = {
  id: string;
  resourceId: string;
  projectId: string | null;
  environmentId: string | null;
  sourceType: string;
  provider: string;
  kind: string;
  metricSource: string;
  status: string;
  sampledAt: Date;
  cpuPercent: number | null;
  memoryUsageBytes: number | null;
  memoryLimitBytes: number | null;
  memoryPercent: number | null;
  networkInputBytes: number | null;
  networkOutputBytes: number | null;
  blockInputBytes: number | null;
  blockOutputBytes: number | null;
  pids: number | null;
  resource?: MetricTrendResourceRef | null;
};

type MetricTrendNumberSummary = {
  latest: number | null;
  average: number | null;
  max: number | null;
  delta: number | null;
};


@Injectable()
export class ResourceControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ResourceControlRepository,
    private readonly listRead: ResourceControlListReadService,
    private readonly binding: ResourceControlBindingService,
    private readonly connectionShared: ResourceControlConnectionSharedService,
    private readonly connectionProbe: ResourceControlConnectionProbeService,
    private readonly resourceQuery: ResourceControlResourceQueryService,
    private readonly action: ResourceControlActionService,
    private readonly metricsService: ResourceControlMetricsService,
    private readonly credentialResolver: DefaultCredentialResolver,
    private readonly executorRouter: ResourceExecutorRouter,
    private readonly directDbQueryExecutor: DirectDbQueryExecutor,
    private readonly auditEventService: AuditEventService,
    private readonly operationApprovalService: OperationApprovalService,
    private readonly serverExecutorService: ServerExecutorService,
    private readonly cloudProviderInventoryService: CloudProviderInventoryService,
    private readonly dockerInventoryExecutorFactory: DockerInventoryExecutorFactory,
    private readonly capabilitiesService: ResourceControlCapabilitiesService = new ResourceControlCapabilitiesService(),
    private readonly cloudProviderHealthService: ResourceControlCloudProviderHealthService = new ResourceControlCloudProviderHealthService(
      prisma,
    ),
  ) {}

  getCapabilities() {
    return this.capabilitiesService.getCapabilities();
  }

  listActions = (teamId: string, query: ListResourceActionsQueryDto) =>
    this.listRead.listActions(teamId, query);
  listResources = (teamId: string, query: ListManagedResourcesQueryDto) =>
    this.listRead.listResources(teamId, query);
  listSyncRuns = (teamId: string) => this.listRead.listSyncRuns(teamId);
  listCloudProviderHealthRuns = (teamId: string) => this.listRead.listCloudProviderHealthRuns(teamId);
  summarizeCloudProviderHealth = (runs: CloudProviderHealthRun[]) =>
    this.listRead.summarizeCloudProviderHealth(runs);
  listActionRuns = (teamId: string, query: ListResourceActionRunsQueryDto) =>
    this.listRead.listActionRuns(teamId, query);
  listMetricSnapshots = (teamId: string, query: ListResourceMetricSnapshotsQueryDto) =>
    this.listRead.listMetricSnapshots(teamId, query);
  listMetricTrends = (teamId: string, query: ListResourceMetricTrendsQueryDto) =>
    this.listRead.listMetricTrends(teamId, query);
  listMetricSeries = (teamId: string, query: ListResourceMetricSeriesQueryDto) =>
    this.listRead.listMetricSeries(teamId, query);
  listConnectionRuns = (teamId: string, query: ListResourceConnectionRunsQueryDto) =>
    this.listRead.listConnectionRuns(teamId, query);
  listQueryRuns = (teamId: string, query: ListResourceQueryRunsQueryDto) =>
    this.listRead.listQueryRuns(teamId, query);
  getResourceAccessScope = (teamId: string, resourceId: string) =>
    this.listRead.getResourceAccessScope(teamId, resourceId);
  resolveResourceBindingTargetAccessScope = (
    teamId: string, resourceId: string, dto: UpdateManagedResourceBindingDto,
  ) => this.listRead.resolveResourceBindingTargetAccessScope(teamId, resourceId, dto);
  resolveEnvironmentAccessScope = (teamId: string, environmentId?: string | null) =>
    this.listRead.resolveEnvironmentAccessScope(teamId, environmentId);

  updateResourceBinding = (
    teamId: string, userId: string, resourceId: string, dto: UpdateManagedResourceBindingDto,
  ) => this.binding.updateResourceBinding(teamId, userId, resourceId, dto);

  probeResourceConnection = (teamId: string, userId: string, resourceId: string, dto: ProbeResourceConnectionDto) =>
    this.connectionProbe.probeResourceConnection(teamId, userId, resourceId, dto);

  runResourceQuery = (teamId: string, userId: string, resourceId: string, dto: RunResourceQueryDto) =>
    this.resourceQuery.runResourceQuery(teamId, userId, resourceId, dto);

  executeResourceAction = (
    teamId: string, userId: string | null, resourceId: string, dto: ExecuteResourceActionDto,
  ) => this.action.executeResourceAction(teamId, userId, resourceId, dto);

  async syncServerDocker(teamId: string, userId: string | null, serverId: string, dto: SyncServerDockerDto) {
    const server = await this.repo.findServer({
      where: { id: serverId, teamId },
      select: {
        id: true,
        name: true,
        host: true,
        status: true,
        services: true,
      },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在');
    }

    const environmentRef = await this.resolveProjectEnvironment(teamId, dto.environmentId);

    const syncRun = await this.repo.createSyncRun({
      data: {
        teamId,
        actorId: userId,
        serverId,
        sourceType: 'server',
        provider: 'docker',
        scope: dto.scope || 'docker',
        status: 'running',
        metadata: toJsonValueUtil({
          syncMode: 'server_executor_inventory',
          adapterBoundary: 'server_executor',
          includeContainers: dto.includeContainers !== false,
          includeMiddleware: dto.includeMiddleware !== false,
          environmentId: environmentRef?.id,
          environmentKey: environmentRef?.key,
          projectId: environmentRef?.projectId,
        }),
      },
    });

    try {
      if (environmentRef) {
        await this.bindServerToEnvironment(teamId, environmentRef, server.id, {
          source: 'resource-control.syncServerDocker',
        });
      }

      const inventory = await this.collectServerDockerInventory(teamId, userId, server, dto, environmentRef);
      const seeds = inventory.seeds;
      const resources = await this.upsertManagedResources(teamId, userId, seeds);
      const services = asRecord(server.services);

      await this.repo.updateServer({
        where: { id: server.id },
        data: {
          services: toJsonValueUtil({
            ...services,
            docker: seeds.some((seed) => seed.kind === 'docker_container'),
            mysql: seeds.some((seed) => seed.kind === 'mysql'),
            redis: seeds.some((seed) => seed.kind === 'redis'),
          }),
        },
      });

      const completedRun = await this.repo.updateSyncRun({
        where: { id: syncRun.id },
        data: {
          status: 'completed',
          discovered: resources.length,
          finishedAt: new Date(),
          metadata: toJsonValueUtil({
            syncMode: inventory.syncMode,
            adapterBoundary: 'server_executor',
            includeContainers: dto.includeContainers !== false,
            includeMiddleware: dto.includeMiddleware !== false,
            environmentId: environmentRef?.id,
            environmentKey: environmentRef?.key,
            projectId: environmentRef?.projectId,
            execution: inventory.execution,
            parser: inventory.parser,
            fallbackReason: inventory.fallbackReason,
          }),
        },
        include: {
          server: { select: { id: true, name: true, host: true } },
          actor: { select: { id: true, name: true, email: true } },
        },
      });

      return { syncRun: completedRun, resources };
    } catch (error) {
      await this.repo.updateSyncRun({
        where: { id: syncRun.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '同步失败',
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async syncCloudResources(teamId: string, userId: string, dto: SyncCloudResourcesDto) {
    const environmentRef = await this.resolveProjectEnvironment(teamId, dto.environmentId);
    const credential = dto.credentialId
      ? await this.repo.findTeamCredential({
          where: { id: dto.credentialId, teamId },
          select: { id: true, name: true, type: true },
        })
      : null;

    if (dto.credentialId && !credential) {
      throw new NotFoundException('云资源凭证不存在');
    }

    const provider = dto.provider || 'all';
    const syncRun = await this.repo.createSyncRun({
      data: {
        teamId,
        actorId: userId,
        credentialId: credential?.id,
        sourceType: 'cloud',
        provider,
        scope: dto.scope || dto.region || 'all',
        status: 'running',
        metadata: toJsonValueUtil({
          syncMode: 'cloud_provider_inventory_adapter',
          adapterBoundary: 'cloud_provider_inventory',
          region: dto.region || 'default',
          credentialName: credential?.name,
          credentialType: credential?.type,
          environmentId: environmentRef?.id,
          environmentKey: environmentRef?.key,
          projectId: environmentRef?.projectId,
        }),
      },
    });

    try {
      const providers = provider === 'all' ? ['aliyun-rds', 'aliyun-sls', 'tencent-cos'] : [provider];
      const inventories = await Promise.all(
        providers.map((item) =>
          this.collectCloudInventory(teamId, item as CloudInventoryProvider, dto, credential, environmentRef),
        ),
      );
      const seeds = inventories.flatMap((inventory) => inventory.seeds);
      const resources = await this.upsertManagedResources(teamId, userId, seeds);

      const completedRun = await this.repo.updateSyncRun({
        where: { id: syncRun.id },
        data: {
          status: 'completed',
          discovered: resources.length,
          finishedAt: new Date(),
          metadata: toJsonValueUtil({
            syncMode: inventories.every((inventory) => inventory.syncMode === 'cloud_inventory_stub_fallback')
              ? 'cloud_inventory_stub_fallback'
              : 'cloud_provider_inventory_adapter',
            adapterBoundary: 'cloud_provider_inventory',
            region: dto.region || 'default',
            credentialName: credential?.name,
            credentialType: credential?.type,
            environmentId: environmentRef?.id,
            environmentKey: environmentRef?.key,
            projectId: environmentRef?.projectId,
            providers: inventories.map((inventory) => ({
              provider: inventory.provider,
              syncMode: inventory.syncMode,
              parsedCount: inventory.parsedCount,
              skippedCount: inventory.skippedCount,
              errors: inventory.errors,
              fallbackReason: inventory.fallbackReason,
              live: inventory.live,
              sdk: inventory.sdk,
              regions: inventory.regions,
              requestPolicy: inventory.requestPolicy,
            })),
          }),
        },
        include: {
          credential: { select: { id: true, name: true, type: true } },
          actor: { select: { id: true, name: true, email: true } },
        },
      });

      return { syncRun: completedRun, resources };
    } catch (error) {
      await this.repo.updateSyncRun({
        where: { id: syncRun.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '同步失败',
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async writeResourceBindingAudit(
    teamId: string,
    userId: string,
    previousResource: {
      id: string;
      name: string;
      sourceType: string;
      provider: string;
      kind: string;
      endpoint: string | null;
    },
    updatedResource: {
      id: string;
      name: string;
      projectId: string | null;
      environmentId: string | null;
      serverId: string | null;
      credentialId: string | null;
      sourceType: string;
      provider: string;
      kind: string;
      endpoint: string | null;
      config: Prisma.JsonValue | null;
      project?: { id: string; name: string } | null;
      environment?: {
        id: string;
        key: string;
        name: string;
        status: string;
      } | null;
      server?: {
        id: string;
        name: string;
        host: string;
        status: string;
      } | null;
      credential?: { id: string; name: string; type: string } | null;
    },
    before: Record<string, unknown>,
    reason?: string,
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: updatedResource.projectId,
      environmentId: updatedResource.environmentId,
      serverId: updatedResource.serverId,
      managedResourceId: updatedResource.id,
      category: 'resource_binding',
      action: 'resource.binding.update',
      targetType: 'managed_resource',
      targetId: updatedResource.id,
      risk: 'low',
      status: 'completed',
      summary: `资源绑定更新 ${updatedResource.name}`,
      metadata: {
        resourceName: updatedResource.name,
        sourceType: updatedResource.sourceType,
        provider: updatedResource.provider,
        kind: updatedResource.kind,
        endpoint: updatedResource.endpoint,
        before,
        after: this.buildResourceBindingSnapshot(updatedResource),
        reason,
        previousResource: {
          id: previousResource.id,
          name: previousResource.name,
          sourceType: previousResource.sourceType,
          provider: previousResource.provider,
          kind: previousResource.kind,
          endpoint: previousResource.endpoint,
        },
      },
    });
  }

  private async getManagedResource(teamId: string, resourceId: string) {
    const resource = await this.repo.findManagedResource({
      where: { id: resourceId, teamId },
      include: managedResourceInclude,
    });

    if (!resource) {
      throw new NotFoundException('托管资源不存在');
    }

    return resource;
  }

  private buildResourceBindingSnapshot(resource: {
    projectId: string | null;
    environmentId: string | null;
    serverId: string | null;
    credentialId: string | null;
    config: Prisma.JsonValue | null;
    project?: { id: string; name: string } | null;
    environment?: {
      id: string;
      key: string;
      name: string;
      status: string;
    } | null;
    server?: { id: string; name: string; host: string; status: string } | null;
    credential?: { id: string; name: string; type: string } | null;
  }) {
    return {
      projectId: resource.projectId,
      projectName: resource.project?.name,
      environmentId: resource.environmentId,
      environmentName: resource.environment?.name,
      environmentKey: resource.environment?.key,
      serverId: resource.serverId,
      serverName: resource.server?.name,
      serverHost: resource.server?.host,
      credentialId: resource.credentialId,
      credentialName: resource.credential?.name,
      credentialType: resource.credential?.type,
      queryCredentialId: this.resolveQueryCredentialId(resource),
    };
  }

  private resolveQueryCredentialId(resource: { config: Prisma.JsonValue | null }) {
    const config = asRecord(resource.config);
    const credentialBindings = asRecord(config.credentialBindings as Prisma.JsonValue | null);
    return asString(credentialBindings.queryCredentialId);
  }

  private mergeQueryCredentialBinding(configValue: Prisma.JsonValue | null, queryCredentialId: string | null) {
    const config = asRecord(configValue);
    const credentialBindings = asRecord(config.credentialBindings as Prisma.JsonValue | null);
    const nextCredentialBindings: Record<string, unknown> = {
      ...credentialBindings,
    };

    if (queryCredentialId) {
      nextCredentialBindings.queryCredentialId = queryCredentialId;
    } else {
      delete nextCredentialBindings.queryCredentialId;
    }

    const nextConfig: Record<string, unknown> = {
      ...config,
      credentialBindings: nextCredentialBindings,
    };

    if (Object.keys(nextCredentialBindings).length === 0) {
      delete nextConfig.credentialBindings;
    }

    return nextConfig;
  }

  private async ensureProject(teamId: string, projectId: string) {
    const project = await this.repo.findProject({
      where: { id: projectId, teamId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在或不属于当前团队');
    }

    return project;
  }

  private async ensureServer(teamId: string, serverId: string) {
    const server = await this.repo.findServer({
      where: { id: serverId, teamId },
      select: { id: true },
    });

    if (!server) {
      throw new NotFoundException('服务器不存在或不属于当前团队');
    }

    return server;
  }

  private async ensureTeamCredential(teamId: string, credentialId: string) {
    const credential = await this.repo.findTeamCredential({
      where: { id: credentialId, teamId },
      select: { id: true },
    });

    if (!credential) {
      throw new NotFoundException('团队凭证不存在或不属于当前团队');
    }

    return credential;
  }

  private async upsertManagedResources(teamId: string, userId: string | null, seeds: ManagedResourceSeed[]) {
    const resources = [];
    const syncedAt = new Date();

    for (const seed of seeds) {
      const resource = await this.repo.upsertManagedResource({
        where: {
          teamId_sourceType_provider_externalId: {
            teamId,
            sourceType: seed.sourceType,
            provider: seed.provider,
            externalId: seed.externalId,
          },
        },
        create: {
          teamId,
          createdById: userId,
          sourceType: seed.sourceType,
          provider: seed.provider,
          kind: seed.kind,
          name: seed.name,
          externalId: seed.externalId,
          status: seed.status,
          endpoint: seed.endpoint,
          serverId: seed.serverId,
          projectId: seed.projectId,
          environmentId: seed.environmentId,
          credentialId: seed.credentialId,
          metadata: seed.metadata ? toJsonValueUtil(seed.metadata) : undefined,
          config: seed.config ? toJsonValueUtil(seed.config) : undefined,
          lastSyncAt: syncedAt,
        },
        update: {
          name: seed.name,
          kind: seed.kind,
          status: seed.status,
          endpoint: seed.endpoint,
          serverId: seed.serverId,
          projectId: seed.projectId,
          environmentId: seed.environmentId,
          credentialId: seed.credentialId,
          metadata: seed.metadata ? toJsonValueUtil(seed.metadata) : undefined,
          config: seed.config ? toJsonValueUtil(seed.config) : undefined,
          syncError: null,
          lastSyncAt: syncedAt,
        },
        include: managedResourceInclude,
      });
      resources.push(resource);
    }

    return resources;
  }

  private async collectServerDockerInventory(
    teamId: string,
    userId: string | null,
    server: ServerInventorySource,
    dto: SyncServerDockerDto,
    environment?: EnvironmentRef | null,
  ) {
    const includeContainers = dto.includeContainers !== false;
    const includeMiddleware = dto.includeMiddleware !== false;

    // Docker API 路径：当服务器 services 元数据含 dockerApiHost/dockerApiSocket 时，
    // 用 dockerode 直连 daemon（结构化数据，免 docker ps 文本解析）。
    if (
      this.dockerInventoryExecutorFactory.usesDockerApi({
        services: server.services,
      })
    ) {
      return this.collectServerDockerInventoryViaApi(
        teamId,
        server,
        dto,
        environment,
        includeContainers,
        includeMiddleware,
      );
    }

    // CLI 路径：通过 server-executor SSH 远程跑 docker ps（默认，服务器只装 CLI）。
    const target = await this.serverExecutorService.resolveTarget(teamId, server.id);
    const execution = await this.serverExecutorService.execute({
      teamId,
      userId: userId || undefined,
      operationKey: 'resource.sync_docker_inventory',
      adapterKey: DOCKER_INVENTORY_ADAPTER_KEY,
      dryRun: false,
      target,
      steps: [
        {
          key: 'docker-ps-json',
          label: 'list docker containers as json lines',
          command: DOCKER_PS_JSON_COMMAND,
          required: true,
          risk: 'low',
          timeoutSeconds: 30,
        },
      ],
      metadata: {
        source: 'resource-control.syncServerDocker',
        inventoryProvider: 'docker',
        includeContainers,
        includeMiddleware,
        environmentId: environment?.id,
        environmentKey: environment?.key,
        projectId: environment?.projectId,
      },
    });
    const executionSummary = this.summarizeServerExecution(execution);

    if (execution.status === 'completed') {
      const stdout = this.readServerExecutionStdout(execution);
      if (stdout !== undefined) {
        const parsed = buildDockerInventorySeedsFromDockerPs(stdout, {
          server,
          environment,
          includeContainers,
          includeMiddleware,
          syncMode: 'server_executor_live',
        });
        return {
          syncMode: 'server_executor_live',
          seeds: parsed.seeds,
          execution: executionSummary,
          parser: {
            parsedCount: parsed.parsedCount,
            skippedCount: parsed.skippedCount,
            errors: parsed.errors,
          },
        };
      }
    }

    const fallbackReason = execution.error || `Server executor ${execution.status}`;
    const seeds = this.buildServerDockerInventory(server, dto, environment).map((seed) => ({
      ...seed,
      metadata: {
        ...(seed.metadata || {}),
        fallbackReason,
      },
    }));
    return {
      syncMode: 'inventory_stub_fallback',
      seeds,
      execution: executionSummary,
      parser: {
        parsedCount: 0,
        skippedCount: 0,
        errors: ['server executor live inventory did not return parseable stdout'],
      },
      fallbackReason,
    };
  }

  /**
   * Docker API 路径：通过 dockerode 直连服务器 Docker daemon 获取容器列表。
   * 当 server.services 含 dockerApiHost/dockerApiSocket 时由 collectServerDockerInventory 路由到此。
   */
  private async collectServerDockerInventoryViaApi(
    teamId: string,
    server: ServerInventorySource,
    dto: SyncServerDockerDto,
    environment: EnvironmentRef | null | undefined,
    includeContainers: boolean,
    includeMiddleware: boolean,
  ) {
    const executor = this.dockerInventoryExecutorFactory.resolve({
      services: server.services,
    });
    try {
      const records = await executor.listContainers({
        teamId,
        serverId: server.id,
      });
      const parsed = buildDockerInventorySeedsFromRecords(records, {
        server,
        environment,
        includeContainers,
        includeMiddleware,
        syncMode: 'docker_api_live',
      });
      return {
        syncMode: 'docker_api_live',
        seeds: parsed.seeds,
        execution: {
          status: 'completed',
          mode: 'docker_api',
          adapterKey: 'docker-api-inventory',
          executable: true,
          warnings: [],
          error: undefined,
        },
        parser: {
          parsedCount: parsed.parsedCount,
          skippedCount: parsed.skippedCount,
          errors: parsed.errors,
        },
      };
    } catch (error) {
      const fallbackReason = error instanceof Error ? error.message : 'Docker API inventory failed';
      const seeds = this.buildServerDockerInventory(server, dto, environment).map((seed) => ({
        ...seed,
        metadata: { ...(seed.metadata || {}), fallbackReason },
      }));
      return {
        syncMode: 'inventory_stub_fallback',
        seeds,
        execution: {
          status: 'failed',
          mode: 'docker_api',
          adapterKey: 'docker-api-inventory',
          executable: true,
          warnings: [],
          error: fallbackReason,
        },
        parser: { parsedCount: 0, skippedCount: 0, errors: [fallbackReason] },
        fallbackReason,
      };
    }
  }

  private summarizeServerExecution(execution: ServerExecutionResult) {
    return {
      status: execution.status,
      mode: execution.mode,
      adapterKey: execution.adapterKey,
      executable: execution.executable,
      warnings: execution.warnings,
      error: execution.error,
    };
  }

  private readServerExecutionStdout(execution: ServerExecutionResult) {
    const result = asRecord(execution.result);
    if (typeof result.stdoutPreview === 'string') {
      return result.stdoutPreview;
    }
    const logs = Array.isArray(execution.logs) ? execution.logs : [];
    const stdoutLog = logs.find((item) => {
      const record = asRecord(item);
      return record.stream === 'stdout' && typeof record.message === 'string';
    });
    if (stdoutLog) {
      const record = asRecord(stdoutLog);
      return typeof record.message === 'string' ? record.message : undefined;
    }
    return undefined;
  }

  private buildServerDockerInventory(
    server: ServerInventorySource,
    dto: SyncServerDockerDto,
    environment?: EnvironmentRef | null,
  ): ManagedResourceSeed[] {
    const seeds: ManagedResourceSeed[] = [];
    const includeContainers = dto.includeContainers !== false;
    const includeMiddleware = dto.includeMiddleware !== false;
    const runtimeStatus = server.status === 'offline' ? 'unknown' : 'running';

    if (includeContainers) {
      seeds.push(
        {
          sourceType: 'server',
          provider: 'docker',
          kind: 'docker_container',
          name: `${server.name} / devpilot-api`,
          externalId: `${server.id}:docker:container:devpilot-api`,
          status: runtimeStatus,
          endpoint: `${server.host}:3101`,
          serverId: server.id,
          projectId: environment?.projectId,
          environmentId: environment?.id,
          metadata: {
            syncMode: 'inventory_stub',
            serverName: server.name,
            environmentKey: environment?.key,
            image: 'svton/devpilot-api:latest',
            ports: ['3101:3101'],
          },
          config: {
            containerName: 'devpilot-api',
            restartPolicy: 'unless-stopped',
          },
        },
        {
          sourceType: 'server',
          provider: 'docker',
          kind: 'docker_container',
          name: `${server.name} / nginx-proxy`,
          externalId: `${server.id}:docker:container:nginx-proxy`,
          status: runtimeStatus,
          endpoint: `${server.host}:80`,
          serverId: server.id,
          projectId: environment?.projectId,
          environmentId: environment?.id,
          metadata: {
            syncMode: 'inventory_stub',
            serverName: server.name,
            environmentKey: environment?.key,
            image: 'nginx:stable',
            ports: ['80:80', '443:443'],
          },
          config: {
            containerName: 'nginx-proxy',
            restartPolicy: 'always',
          },
        },
      );
    }

    if (includeMiddleware) {
      seeds.push(
        {
          sourceType: 'server',
          provider: 'docker',
          kind: 'mysql',
          name: `${server.name} / mysql-primary`,
          externalId: `${server.id}:docker:mysql:mysql-primary`,
          status: 'active',
          endpoint: `${server.host}:3306`,
          serverId: server.id,
          projectId: environment?.projectId,
          environmentId: environment?.id,
          metadata: {
            syncMode: 'inventory_stub',
            serverName: server.name,
            environmentKey: environment?.key,
            engine: 'mysql',
            deployedBy: 'docker',
          },
          config: {
            databaseEngine: 'mysql',
            containerName: 'mysql-primary',
            port: 3306,
          },
        },
        {
          sourceType: 'server',
          provider: 'docker',
          kind: 'redis',
          name: `${server.name} / redis-cache`,
          externalId: `${server.id}:docker:redis:redis-cache`,
          status: 'active',
          endpoint: `${server.host}:6379`,
          serverId: server.id,
          projectId: environment?.projectId,
          environmentId: environment?.id,
          metadata: {
            syncMode: 'inventory_stub',
            serverName: server.name,
            environmentKey: environment?.key,
            engine: 'redis',
            deployedBy: 'docker',
          },
          config: {
            databaseEngine: 'redis',
            containerName: 'redis-cache',
            port: 6379,
          },
        },
      );
    }

    return seeds;
  }

  private async collectCloudInventory(
    teamId: string,
    provider: CloudInventoryProvider,
    dto: SyncCloudResourcesDto,
    credential?: { id: string; name: string; type: string } | null,
    environment?: EnvironmentRef | null,
  ) {
    const region = dto.region || (provider === 'tencent-cos' ? 'ap-shanghai' : 'cn-hangzhou');
    return this.cloudProviderInventoryService.collect({
      teamId,
      provider,
      region,
      regionExplicit: Boolean(dto.region),
      credential,
      environment,
    });
  }

  private async resolveProjectEnvironment(teamId: string, environmentId?: string): Promise<EnvironmentRef | null> {
    if (!environmentId) {
      return null;
    }

    const environment = await this.repo.findProjectEnvironment({
      where: { id: environmentId, teamId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true },
    });

    if (!environment) {
      throw new NotFoundException('项目环境不存在或已归档');
    }

    return environment;
  }

  private async bindServerToEnvironment(
    teamId: string,
    environment: EnvironmentRef,
    serverId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.repo.upsertProjectEnvironmentServer({
      where: {
        environmentId_serverId: {
          environmentId: environment.id,
          serverId,
        },
      },
      create: {
        teamId,
        projectId: environment.projectId,
        environmentId: environment.id,
        serverId,
        role: 'runtime',
        metadata: toJsonValueUtil(metadata),
      },
      update: {
        projectId: environment.projectId,
        status: 'active',
        role: 'runtime',
        metadata: toJsonValueUtil(metadata),
      },
    });
  }


  private hasOwn<T extends object>(value: T, key: keyof T) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

}
