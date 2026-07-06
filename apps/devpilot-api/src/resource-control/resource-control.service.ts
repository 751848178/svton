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

  async runResourceQuery(teamId: string, userId: string, resourceId: string, dto: RunResourceQueryDto) {
    const resource = await this.getManagedResource(teamId, resourceId);
    const action = this.connectionShared.buildConnectionProbeAction(resource);
    const credential = await this.connectionShared.resolveResourceQueryCredential(teamId, resource, action);
    const dryRun = dto.dryRun ?? true;
    const params = dto.params || {};
    const queryType = resolveQueryTypeUtil(resource, dto.queryType);
    const query = normalizeResourceQueryUtil(resource, queryType, dto.query, params, asString);
    const authAdapterKey = this.connectionShared.resolveAuthAdapterKey(resource, credential);
    const executionShape = resolveQueryExecutionShapeUtil(resource);
    const runCredentialId = this.connectionShared.resolveQueryRunCredentialId(resource, credential);

    const run = await this.repo.createQueryRun({
      data: {
        teamId,
        actorId: userId,
        resourceId: resource.id,
        credentialId: runCredentialId,
        projectId: resource.projectId,
        environmentId: resource.environmentId,
        serverId: resource.serverId,
        sourceType: resource.sourceType,
        provider: resource.provider,
        kind: resource.kind,
        queryType,
        query,
        authAdapterKey,
        executorKey: executionShape.executorKey,
        adapterKey: executionShape.adapterKey,
        dryRun,
        status: 'running',
        params: toJsonValueUtil(params),
      },
    });

    try {
      const execution = await this.executeResourceQueryPlan(teamId, resource, credential, run.id, {
        dryRun,
        params,
        query,
        queryType,
        authAdapterKey,
      });
      const completed = await this.repo.updateQueryRun({
        where: { id: run.id },
        data: {
          status: execution.status,
          executorKey: execution.executorKey,
          adapterKey: execution.adapterKey,
          authAdapterKey: execution.authAdapterKey,
          queryPlan: execution.queryPlan,
          result: execution.result,
          error: execution.error,
          finishedAt: new Date(),
        },
        include: this.queryRunInclude(),
      });
      await this.writeResourceQueryAudit(teamId, userId, resource, completed);
      return completed;
    } catch (error) {
      const failed = await this.repo.updateQueryRun({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '资源查询计划生成失败',
          finishedAt: new Date(),
        },
        include: this.queryRunInclude(),
      });
      await this.writeResourceQueryAudit(teamId, userId, resource, failed);
      return failed;
    }
  }

  async executeResourceAction(
    teamId: string,
    userId: string | null,
    resourceId: string,
    dto: ExecuteResourceActionDto,
  ) {
    const resource = await this.getManagedResource(teamId, resourceId);
    const action = getActionDefinition(dto.action);

    if (!action) {
      throw new BadRequestException('不支持的资源动作');
    }

    if (!isActionSupported(action, resource)) {
      throw new BadRequestException(
        `动作 ${action.key} 不支持 ${resource.sourceType}/${resource.provider}/${resource.kind}`,
      );
    }

    const dryRun = dto.dryRun !== false;
    const params = dto.params || {};
    if (!dryRun && action.dryRunOnly) {
      throw new BadRequestException('当前资源动作只支持 dry-run 计划');
    }

    const requiresApproval = requiresResourceApprovalUtil(action, dryRun);
    if (requiresApproval && !userId) {
      throw new BadRequestException('系统调度不支持需要审批的资源动作');
    }
    const approvalContext = requiresApproval
      ? this.buildResourceApprovalContext(teamId, userId!, resource, action, dto.approvalReason)
      : null;
    const approvedApproval = requiresApproval
      ? await this.operationApprovalService.resolveApproved({
          ...approvalContext!,
          approvalId: dto.approvalId,
        })
      : null;
    const credential = await this.credentialResolver.resolve(teamId, resource, action);
    const executorInput = {
      teamId,
      userId,
      resource,
      action,
      credential,
      params,
      dryRun,
      queue: false,
      maxAttempts: dto.maxAttempts,
      confirmationText: dto.confirmationText,
    };
    const executor = this.executorRouter.resolve(executorInput);
    const queue = dto.queue === true && executor.key === 'server-executor';
    const actionRun = await this.repo.createActionRun({
      data: {
        teamId,
        actorId: userId,
        resourceId: resource.id,
        credentialId: resource.credentialId,
        action: action.key,
        executorKey: executor.key,
        adapterKey: executor.adapterKey,
        dryRun,
        risk: action.risk,
        status: queue ? 'queued' : 'running',
        operationApprovalId: approvedApproval?.id,
        params: toJsonValueUtil(params),
      },
    });

    try {
      if (requiresApproval && !approvedApproval) {
        const approval = await this.operationApprovalService.createPending({
          ...approvalContext!,
          metadata: {
            ...approvalContext!.metadata,
            resourceActionRunId: actionRun.id,
            params,
            queue,
            maxAttempts: dto.maxAttempts,
          },
        });
        const blocked = await this.repo.updateActionRun({
          where: { id: actionRun.id },
          data: {
            status: 'blocked',
            operationApprovalId: approval.id,
            error: '非 dry-run 的中高风险资源动作需要审批',
            finishedAt: new Date(),
            result: toJsonValueUtil({
              mode: 'blocked_operation_approval',
              approvalId: approval.id,
              approvalStatus: approval.status,
            }),
          },
          include: this.actionRunInclude(),
        });
        await this.writeResourceActionAudit(teamId, userId, resource, action, blocked);
        return blocked;
      }

      if (action.requiresConfirmation && !dryRun && dto.confirmationText !== resource.name) {
        const blocked = await this.repo.updateActionRun({
          where: { id: actionRun.id },
          data: {
            status: 'blocked',
            error: '需要输入资源名称确认后才能执行非 dry-run 动作',
            finishedAt: new Date(),
            result: toJsonValueUtil({
              mode: 'blocked_confirmation',
              requiredConfirmationText: resource.name,
            }),
          },
          include: this.actionRunInclude(),
        });
        await this.writeResourceActionAudit(teamId, userId, resource, action, blocked);
        return blocked;
      }

      const result = await executor.execute({
        ...executorInput,
        queue,
        resourceActionRunId: actionRun.id,
        operationApprovalId: approvedApproval?.id,
      });
      const completedData: Prisma.ResourceActionRunUncheckedUpdateInput = {
        status: result.status,
        commandPlan: result.commandPlan,
        result: result.result,
        error: result.error,
        ...(result.serverExecutionJobId ? { serverExecutionJobId: result.serverExecutionJobId } : {}),
        ...(result.status === 'queued' ? {} : { finishedAt: new Date() }),
      };
      const completed = await this.repo.updateActionRun({
        where: { id: actionRun.id },
        data: completedData,
        include: this.actionRunInclude(),
      });
      if (completed.status === 'completed') {
        await this.persistDockerMetricSnapshotsFromActionRun(teamId, completed.id, result.result, result.logs);
      }
      await this.writeResourceActionAudit(teamId, userId, resource, action, completed);
      if (approvedApproval && completed.status !== 'blocked') {
        await this.operationApprovalService.consume(teamId, approvedApproval.id);
      }
      return completed;
    } catch (error) {
      const failed = await this.repo.updateActionRun({
        where: { id: actionRun.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '资源动作执行失败',
          finishedAt: new Date(),
        },
        include: this.actionRunInclude(),
      });
      await this.writeResourceActionAudit(teamId, userId, resource, action, failed);
      return failed;
    }
  }

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

  private async persistDockerMetricSnapshotsFromActionRun(
    teamId: string,
    resourceActionRunId: string,
    result: unknown,
    logs?: unknown,
  ) {
    const actionRun = await this.repo.findActionRun({
      where: { id: resourceActionRunId, teamId },
      select: {
        id: true,
        teamId: true,
        resourceId: true,
        action: true,
        dryRun: true,
        status: true,
        resource: {
          select: {
            id: true,
            sourceType: true,
            provider: true,
            kind: true,
            serverId: true,
            projectId: true,
            environmentId: true,
          },
        },
      },
    });

    if (
      !actionRun ||
      actionRun.action !== 'docker.container.stats' ||
      actionRun.dryRun ||
      actionRun.status !== 'completed'
    ) {
      return 0;
    }

    const existingCount = await this.repo.countMetricSnapshots({
      where: { teamId, resourceActionRunId },
    });
    if (existingCount > 0) {
      return 0;
    }

    const snapshots = buildDockerStatsMetricSnapshotInputs(
      {
        teamId: actionRun.teamId,
        resourceId: actionRun.resourceId,
        resourceActionRunId: actionRun.id,
        serverId: actionRun.resource.serverId,
        projectId: actionRun.resource.projectId,
        environmentId: actionRun.resource.environmentId,
        sourceType: actionRun.resource.sourceType,
        provider: actionRun.resource.provider,
        kind: actionRun.resource.kind,
      },
      result,
      logs,
    );

    if (snapshots.length === 0) {
      return 0;
    }

    const created = await this.repo.createManyMetricSnapshots({
      data: snapshots,
    });
    return created.count;
  }

  private managedResourceInclude() {
    return managedResourceInclude;
  }

  private actionRunInclude() {
    return actionRunInclude;
  }

  private metricSnapshotInclude() {
    return metricSnapshotInclude;
  }

  private connectionRunInclude() {
    return connectionRunInclude;
  }

  private queryRunInclude() {
    return queryRunInclude;
  }


  private buildResourceApprovalContext(
    teamId: string,
    userId: string,
    resource: {
      id: string;
      name: string;
      projectId: string | null;
      environmentId: string | null;
      serverId: string | null;
      sourceType: string;
      provider: string;
      kind: string;
      endpoint: string | null;
    },
    action: { key: string; risk: string; mode: string },
    reason?: string,
  ) {
    return {
      teamId,
      requesterId: userId,
      projectId: resource.projectId,
      environmentId: resource.environmentId,
      serverId: resource.serverId,
      managedResourceId: resource.id,
      category: 'resource_action',
      action: `resource.${action.key}`,
      targetType: 'managed_resource',
      targetId: resource.id,
      risk: action.risk,
      summary: `申请执行资源动作 ${action.key}`,
      reason: reason || '申请执行非 dry-run 资源动作',
      metadata: {
        resourceName: resource.name,
        sourceType: resource.sourceType,
        provider: resource.provider,
        kind: resource.kind,
        endpoint: resource.endpoint,
        mode: action.mode,
      },
    };
  }

  private async executeResourceQueryPlan(
    teamId: string,
    resource: ManagedResourceForConnection,
    credential: ResolvedCredentialRef,
    runId: string,
    options: {
      dryRun: boolean;
      params: Record<string, unknown>;
      query: string;
      queryType: string;
      authAdapterKey: string;
    },
  ): Promise<ResourceQueryExecutionResult> {
    const shape = resolveQueryExecutionShapeUtil(resource);
    const validation = validateReadOnlyQueryUtil(options.queryType, options.query);
    const missingCredential = resource.sourceType === 'cloud' && credential.source !== 'team_credential';
    const directDbLiveQuery = canExecuteDirectDbLiveQueryUtil(resource, credential, options.queryType);
    const liveMissingConfirmation = !options.dryRun && directDbLiveQuery && !isLiveQueryConfirmedUtil(options.params);
    const liveUnsupported = !options.dryRun && !directDbLiveQuery;
    const plannedCalls = this.plannedCallsForQuery(resource, options.queryType, options.query, options.params);
    const resultContract = queryResultContractUtil(options.queryType);
    const livePrerequisites = this.livePrerequisitesForQuery(
      resource,
      credential,
      shape.adapterKey,
      validation,
      !options.dryRun && directDbLiveQuery,
    );
    const preview = this.buildResourceQueryResultPreview(
      resource,
      options.queryType,
      options.query,
      options.params,
      resultContract,
    );
    const warnings = [
      ...(!validation.ok ? [validation.reason] : []),
      ...(missingCredential ? ['resource has no TeamCredential binding'] : []),
      ...(liveUnsupported ? ['live resource query execution only supports direct DB MySQL/Redis adapters'] : []),
      ...(liveMissingConfirmation ? ['live resource query requires params.confirmLiveRead=true'] : []),
    ];
    const executable = warnings.length === 0;
    const status = executable ? 'completed' : 'blocked';
    const error = warnings.join('；') || undefined;
    const queryPlan = toJsonValueUtil({
      executorKey: shape.executorKey,
      adapterKey: shape.adapterKey,
      operationKey: 'resource.query.readonly',
      dryRun: options.dryRun,
      executable,
      target: buildConnectionTargetUtil(resource),
      auth: {
        adapterKey: options.authAdapterKey,
        credential,
      },
      query: {
        type: options.queryType,
        text: options.query,
        readOnly: validation.ok,
        params: options.params,
      },
      safety: {
        readOnlyOnly: true,
        arbitraryShell: false,
        secretsInOutput: 'must_mask_before_persisting',
        liveExecutionDefault: directDbLiveQuery
          ? 'requires_explicit_confirmLiveRead'
          : 'blocked_until_driver_adapter_ready',
        adapterBoundary: shape.executorKey,
      },
      warnings,
      metadata: {
        resourceQueryRunId: runId,
        nextExecutorBoundary: this.nextQueryExecutorBoundary(shape.adapterKey),
      },
      plannedCalls,
      resultContract,
      livePrerequisites,
    });

    if (!options.dryRun && executable && directDbLiveQuery) {
      const liveExecution = await this.directDbQueryExecutor.execute({
        teamId,
        resource,
        credential,
        queryType: options.queryType,
        query: options.query,
        params: options.params,
        contract: resultContract,
        adapterKey: shape.adapterKey,
        authAdapterKey: options.authAdapterKey,
        runId,
      });

      return {
        status: liveExecution.status,
        executorKey: shape.executorKey,
        adapterKey: shape.adapterKey,
        authAdapterKey: options.authAdapterKey,
        queryPlan,
        result: liveExecution.result,
        error: liveExecution.error,
      };
    }

    return {
      status,
      executorKey: shape.executorKey,
      adapterKey: shape.adapterKey,
      authAdapterKey: options.authAdapterKey,
      queryPlan,
      result: toJsonValueUtil({
        mode: options.dryRun ? 'resource_query_plan' : 'blocked_live_transport',
        executed: false,
        executorKey: shape.executorKey,
        adapterKey: shape.adapterKey,
        authAdapterKey: options.authAdapterKey,
        adapterState: {
          current: options.dryRun ? 'dry_run_contract_preview' : 'blocked_live_transport',
          executable: executable && options.dryRun,
          nextExecutorBoundary: this.nextQueryExecutorBoundary(shape.adapterKey),
        },
        preview,
        livePrerequisites,
        warnings,
      }),
      error,
    };
  }


  private buildResourceQueryResultPreview(
    resource: ManagedResourceForConnection,
    queryType: string,
    query: string,
    params: Record<string, unknown>,
    contract: {
      shape: string;
      columns: Array<{
        key: string;
        label: string;
        type: string;
        masked: boolean;
      }>;
      rowLimitDefault: number;
      rowLimitMax: number;
    },
  ) {
    const limit = asPositiveInt(params.limit, contract.rowLimitDefault, contract.rowLimitMax);
    const cursor = asString(params.cursor);
    const rows = this.sampleRowsForQueryPreview(resource, queryType, query);
    const redaction = {
      enabled: true,
      policy: 'mask_secret_like_columns_before_persisting',
      maskedColumnKeys: contract.columns.filter((column) => column.masked).map((column) => column.key),
      secretKeyPatterns: ['password', 'secret', 'token', 'credential', 'authorization', 'accessKey', 'secretKey'],
    };

    return {
      source: 'contract_sample',
      sample: true,
      shape: contract.shape,
      columns: contract.columns,
      rows: rows.map((row) => maskQueryPreviewRowUtil(row, redaction.secretKeyPatterns)),
      pageInfo: {
        limit,
        returned: Math.min(rows.length, limit),
        hasMore: false,
        cursor: cursor || null,
        nextCursor: null,
      },
      redaction,
      notes: [
        '当前结果来自只读 adapter 契约预览，不包含真实线上数据。',
        '真实 adapter 接入后会复用相同 columns/rows/pageInfo/redaction 结构。',
      ],
    };
  }

  private sampleRowsForQueryPreview(
    resource: ManagedResourceForConnection,
    queryType: string,
    query: string,
  ): Array<Record<string, unknown>> {
    if (queryType === 'sql') {
      if (/^\s*select\s+1\s*;?\s*$/i.test(query)) {
        return [{ column: '1', value: 1 }];
      }
      if (/^\s*(show|describe|desc|explain)\b/i.test(query)) {
        return [
          {
            column: 'operation',
            value: query.trim().split(/\s+/).slice(0, 2).join(' '),
          },
          { column: 'target', value: resource.name },
        ];
      }
      return [
        { column: 'row_number', value: 1 },
        { column: 'preview', value: `${resource.provider}/${resource.kind}` },
      ];
    }

    if (queryType === 'redis_scan') {
      return [
        { cursor: '0', key: 'app:example:key', type: 'string', ttl: 3600 },
        { cursor: '0', key: 'app:example:hash', type: 'hash', ttl: -1 },
      ];
    }

    if (queryType === 'sls_query') {
      return [
        {
          time: new Date(0).toISOString(),
          level: 'INFO',
          message: 'sample log line with sensitive fields masked before persistence',
        },
      ];
    }

    if (queryType === 'cos_list') {
      const prefix = query || 'assets/';
      return [
        {
          key: `${prefix}example.txt`,
          size: 128,
          lastModified: new Date(0).toISOString(),
          storageClass: 'STANDARD',
        },
      ];
    }

    return [
      { field: 'provider', value: resource.provider },
      { field: 'kind', value: resource.kind },
      { field: 'endpoint', value: resource.endpoint || resource.externalId },
    ];
  }

  private livePrerequisitesForQuery(
    resource: ManagedResourceForConnection,
    credential: ResolvedCredentialRef,
    adapterKey: string,
    validation: { ok: boolean; reason: string },
    liveAdapterReady = false,
  ) {
    const needsCloudCredential = resource.sourceType === 'cloud';
    const needsServerCredential = resource.sourceType === 'server';
    const needsDirectDbCredential =
      resource.kind === 'mysql' || resource.kind === 'database' || resource.kind === 'redis';
    const hasDirectDbCredential = credential.transport === 'direct_db';

    return [
      {
        key: 'read_only_validation',
        status: validation.ok ? 'ready' : 'blocked',
        detail: validation.reason,
      },
      {
        key: 'credential_binding',
        status:
          needsDirectDbCredential && hasDirectDbCredential
            ? 'ready'
            : needsCloudCredential
              ? credential.source === 'team_credential'
                ? 'ready'
                : 'missing'
              : needsServerCredential
                ? credential.source === 'server'
                  ? 'ready'
                  : 'missing'
                : 'missing',
        detail:
          needsDirectDbCredential && hasDirectDbCredential
            ? 'Direct DB read-only credential is bound for query adapter.'
            : needsCloudCredential
              ? 'Cloud provider query requires TeamCredential binding.'
              : needsServerCredential
                ? 'Server resource query requires Server credential binding.'
                : 'Manual resource query requires a credential binding.',
      },
      {
        key: 'read_only_driver_credential',
        status: needsDirectDbCredential ? (hasDirectDbCredential ? 'ready' : 'missing') : 'not_required',
        detail: needsDirectDbCredential
          ? hasDirectDbCredential
            ? 'Dedicated read-only account credential is bound; live driver adapter is still disabled.'
            : 'Database/Redis live query still needs a dedicated read-only account credential model.'
          : 'Provider SDK read operations use TeamCredential.',
      },
      {
        key: 'executor_adapter',
        status: liveAdapterReady ? 'ready' : 'missing',
        detail: liveAdapterReady
          ? `${adapterKey} live readonly transport is enabled for this run.`
          : `${adapterKey} live transport is not enabled for this run; current output is a dry-run result contract or blocked live request.`,
      },
    ];
  }



  private plannedCallsForQuery(
    resource: ManagedResourceForConnection,
    queryType: string,
    query: string,
    params: Record<string, unknown>,
  ) {
    const config = asRecord(resource.config);
    const metadata = asRecord(resource.metadata);
    const region = asString(metadata.region) || asString(params.region) || 'default';

    if (queryType === 'sql') {
      return [
        {
          adapter: resource.provider === 'aliyun-rds' ? 'mysql-rds-driver' : 'mysql-docker-driver',
          operation: 'readonlyQuery',
          params: {
            endpoint: resource.endpoint,
            database: asString(params.database) || asString(config.database),
            sql: query,
          },
        },
      ];
    }

    if (queryType === 'redis_scan') {
      return [
        {
          adapter: 'redis-driver',
          operation: 'readonlyCommand',
          params: {
            endpoint: resource.endpoint,
            command: query,
          },
        },
      ];
    }

    if (queryType === 'sls_query') {
      return [
        {
          provider: 'aliyun-sls',
          operation: 'GetLogs',
          params: {
            region,
            project: asString(config.project) || resource.name,
            logstore: asString(config.logstore),
            query,
            limit: asPositiveInt(params.limit, 100, 1000),
          },
        },
      ];
    }

    if (queryType === 'cos_list') {
      return [
        {
          provider: 'tencent-cos',
          operation: 'GetBucket',
          params: {
            region,
            bucket: asString(config.bucket) || resource.name,
            prefix: query,
            maxKeys: asPositiveInt(params.limit, 100, 1000),
          },
        },
      ];
    }

    return [
      {
        provider: resource.provider,
        operation: 'DescribeResource',
        params: {
          resourceId: resource.externalId,
        },
      },
    ];
  }

  private nextQueryExecutorBoundary(adapterKey: string) {
    const mapping: Record<string, string> = {
      'mysql-query-plan': 'mysql_driver_adapter',
      'redis-query-plan': 'redis_driver_adapter',
      'aliyun-sls-query-plan': 'aliyun_sls_sdk_adapter',
      'tencent-cos-query-plan': 'tencent_cos_sdk_adapter',
    };
    return mapping[adapterKey] || 'resource_query_adapter';
  }

  private async writeResourceActionAudit(
    teamId: string,
    userId: string | null,
    resource: {
      id: string;
      name: string;
      projectId: string | null;
      environmentId: string | null;
      serverId: string | null;
      sourceType: string;
      provider: string;
      kind: string;
      endpoint: string | null;
    },
    action: { key: string; risk: string },
    actionRun: {
      id: string;
      status: string;
      dryRun: boolean;
      executorKey: string;
      adapterKey: string;
      operationApprovalId?: string | null;
      error: string | null;
    },
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: resource.projectId,
      environmentId: resource.environmentId,
      serverId: resource.serverId,
      managedResourceId: resource.id,
      resourceActionRunId: actionRun.id,
      operationApprovalId: actionRun.operationApprovalId,
      category: 'resource_action',
      action: `resource.${action.key}`,
      targetType: 'managed_resource',
      targetId: resource.id,
      risk: action.risk,
      status: actionRun.status,
      summary: `资源动作 ${action.key} ${actionRun.status}`,
      metadata: {
        dryRun: actionRun.dryRun,
        sourceType: resource.sourceType,
        provider: resource.provider,
        kind: resource.kind,
        endpoint: resource.endpoint,
        resourceName: resource.name,
        executorKey: actionRun.executorKey,
        adapterKey: actionRun.adapterKey,
        operationApprovalId: actionRun.operationApprovalId,
        error: actionRun.error,
      },
    });
  }


  private async writeResourceQueryAudit(
    teamId: string,
    userId: string,
    resource: {
      id: string;
      name: string;
      projectId: string | null;
      environmentId: string | null;
      serverId: string | null;
      sourceType: string;
      provider: string;
      kind: string;
      endpoint: string | null;
    },
    queryRun: {
      id: string;
      status: string;
      dryRun: boolean;
      queryType: string;
      executorKey: string;
      adapterKey: string;
      authAdapterKey: string;
      error: string | null;
    },
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: resource.projectId,
      environmentId: resource.environmentId,
      serverId: resource.serverId,
      managedResourceId: resource.id,
      resourceQueryRunId: queryRun.id,
      category: 'resource_query',
      action: 'resource.query.readonly',
      targetType: 'managed_resource',
      targetId: resource.id,
      risk: 'low',
      status: queryRun.status,
      summary: `资源只读查询 ${resource.name} ${queryRun.status}`,
      metadata: {
        dryRun: queryRun.dryRun,
        queryType: queryRun.queryType,
        sourceType: resource.sourceType,
        provider: resource.provider,
        kind: resource.kind,
        endpoint: resource.endpoint,
        resourceName: resource.name,
        executorKey: queryRun.executorKey,
        adapterKey: queryRun.adapterKey,
        authAdapterKey: queryRun.authAdapterKey,
        error: queryRun.error,
      },
    });
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
      include: this.managedResourceInclude(),
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
        include: this.managedResourceInclude(),
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
