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

  async listActions(teamId: string, query: ListResourceActionsQueryDto) {
    if (!query.resourceId) {
      return RESOURCE_ACTIONS;
    }

    const resource = await this.getManagedResource(teamId, query.resourceId);
    return getActionsForResource(resource);
  }

  async listResources(teamId: string, query: ListManagedResourcesQueryDto) {
    return this.repo.findManagedResources({
      where: buildManagedResourceWhere(teamId, query),
      orderBy: [{ sourceType: 'asc' }, { provider: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
      include: this.managedResourceInclude(),
    });
  }

  async listSyncRuns(teamId: string) {
    return this.repo.findSyncRuns({
      where: { teamId },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: {
        server: { select: { id: true, name: true, host: true } },
        credential: { select: { id: true, name: true, type: true } },
        actor: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async listCloudProviderHealthRuns(teamId: string) {
    return this.cloudProviderHealthService.listRuns(teamId);
  }

  summarizeCloudProviderHealth(runs: CloudProviderHealthRun[]) {
    return this.cloudProviderHealthService.summarize(runs);
  }

  async listActionRuns(teamId: string, query: ListResourceActionRunsQueryDto) {
    return this.repo.findActionRuns({
      where: buildResourceActionRunWhere(teamId, query),
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: this.actionRunInclude(),
    });
  }

  async listMetricSnapshots(teamId: string, query: ListResourceMetricSnapshotsQueryDto) {
    return this.repo.findMetricSnapshots({
      where: buildResourceMetricSnapshotWhere(teamId, query),
      orderBy: { sampledAt: 'desc' },
      take: 100,
      include: this.metricSnapshotInclude(),
    });
  }

  async listMetricTrends(teamId: string, query: ListResourceMetricTrendsQueryDto) {
    const windowMinutes = parseMetricTrendWindowMinutesUtil(query.windowMinutes);
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

    const snapshots = await this.repo.findMetricSnapshots({
      where: buildResourceMetricSnapshotWhere(teamId, query, cutoff),
      orderBy: { sampledAt: 'desc' },
      take: 500,
      include: this.metricSnapshotInclude(),
    });

    return this.summarizeMetricTrends(snapshots, windowMinutes);
  }

  async listMetricSeries(teamId: string, query: ListResourceMetricSeriesQueryDto) {
    const windowMinutes = parseMetricTrendWindowMinutesUtil(query.windowMinutes || '360');
    const limit = parseMetricSeriesLimitUtil(query.limit);
    const metric = parseMetricSeriesMetricUtil(query.metric);
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

    const snapshots = await this.repo.findMetricSnapshots({
      where: buildResourceMetricSnapshotWhere(teamId, query, cutoff),
      orderBy: { sampledAt: 'desc' },
      take: limit,
      include: this.metricSnapshotInclude(),
    });

    return this.buildMetricSeries(snapshots, metric, windowMinutes, limit);
  }

  summarizeMetricTrends(snapshots: ResourceMetricSnapshotForTrend[], windowMinutes = 60) {
    const groups = new Map<string, ResourceMetricSnapshotForTrend[]>();
    for (const snapshot of snapshots) {
      const key = `${snapshot.resourceId}:${snapshot.metricSource}`;
      groups.set(key, [...(groups.get(key) || []), snapshot]);
    }

    return Array.from(groups.values())
      .map((group) => {
        const ordered = [...group].sort((left, right) => right.sampledAt.getTime() - left.sampledAt.getTime());
        const latest = ordered[0];
        const oldest = ordered[ordered.length - 1];

        return {
          id: latest.resourceId,
          resourceId: latest.resourceId,
          projectId: latest.projectId,
          environmentId: latest.environmentId,
          sourceType: latest.sourceType,
          provider: latest.provider,
          kind: latest.kind,
          metricSource: latest.metricSource,
          windowMinutes,
          sampleCount: ordered.length,
          firstSampledAt: oldest.sampledAt,
          lastSampledAt: latest.sampledAt,
          resource: latest.resource,
          cpuPercent: summarizeMetricNumberUtil(ordered.map((snapshot) => snapshot.cpuPercent)),
          memoryPercent: summarizeMetricNumberUtil(ordered.map((snapshot) => snapshot.memoryPercent)),
          memoryUsageBytes: summarizeMetricNumberUtil(ordered.map((snapshot) => snapshot.memoryUsageBytes)),
          networkInputBytes: summarizeMetricNumberUtil(ordered.map((snapshot) => snapshot.networkInputBytes)),
          networkOutputBytes: summarizeMetricNumberUtil(ordered.map((snapshot) => snapshot.networkOutputBytes)),
          blockInputBytes: summarizeMetricNumberUtil(ordered.map((snapshot) => snapshot.blockInputBytes)),
          blockOutputBytes: summarizeMetricNumberUtil(ordered.map((snapshot) => snapshot.blockOutputBytes)),
          pids: summarizeMetricNumberUtil(ordered.map((snapshot) => snapshot.pids)),
        };
      })
      .sort((left, right) => right.lastSampledAt.getTime() - left.lastSampledAt.getTime());
  }

  buildMetricSeries(
    snapshots: ResourceMetricSnapshotForTrend[],
    metric: ResourceMetricSeriesMetric = 'cpuPercent',
    windowMinutes = 360,
    limit = 120,
  ) {
    const groups = new Map<string, ResourceMetricSnapshotForTrend[]>();
    for (const snapshot of snapshots) {
      const key = `${snapshot.resourceId}:${snapshot.metricSource}`;
      groups.set(key, [...(groups.get(key) || []), snapshot]);
    }

    return Array.from(groups.values())
      .map((group) => {
        const ordered = [...group].sort((left, right) => left.sampledAt.getTime() - right.sampledAt.getTime());
        const latest = ordered[ordered.length - 1];
        const oldest = ordered[0];
        const valuesLatestFirst = [...ordered].reverse().map((snapshot) => metricSeriesValueUtil(snapshot, metric));
        const points = ordered.map((snapshot) => ({
          snapshotId: snapshot.id,
          sampledAt: snapshot.sampledAt,
          value: metricSeriesValueUtil(snapshot, metric),
          status: snapshot.status,
        }));

        return {
          id: `${latest.resourceId}:${latest.metricSource}:${metric}`,
          resourceId: latest.resourceId,
          projectId: latest.projectId,
          environmentId: latest.environmentId,
          sourceType: latest.sourceType,
          provider: latest.provider,
          kind: latest.kind,
          metricSource: latest.metricSource,
          metric,
          windowMinutes,
          limit,
          sampleCount: ordered.length,
          firstSampledAt: oldest.sampledAt,
          lastSampledAt: latest.sampledAt,
          resource: latest.resource,
          summary: summarizeMetricNumberUtil(valuesLatestFirst),
          points,
        };
      })
      .sort((left, right) => right.lastSampledAt.getTime() - left.lastSampledAt.getTime());
  }

  async listConnectionRuns(teamId: string, query: ListResourceConnectionRunsQueryDto) {
    return this.repo.findConnectionRuns({
      where: buildResourceConnectionRunWhere(teamId, query),
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: this.connectionRunInclude(),
    });
  }

  async listQueryRuns(teamId: string, query: ListResourceQueryRunsQueryDto) {
    return this.repo.findQueryRuns({
      where: buildResourceQueryRunWhere(teamId, query),
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: this.queryRunInclude(),
    });
  }

  async getResourceAccessScope(teamId: string, resourceId: string) {
    const resource = await this.getManagedResource(teamId, resourceId);
    return {
      projectId: resource.projectId,
      environmentId: resource.environmentId,
    };
  }

  async resolveResourceBindingTargetAccessScope(
    teamId: string,
    resourceId: string,
    dto: UpdateManagedResourceBindingDto,
  ) {
    const currentScope = await this.getResourceAccessScope(teamId, resourceId);
    const hasProject = this.hasOwn(dto, 'projectId');
    const hasEnvironment = this.hasOwn(dto, 'environmentId');

    if (!hasProject && !hasEnvironment) {
      return currentScope;
    }

    if (hasEnvironment) {
      if (dto.environmentId) {
        const environment = await this.resolveProjectEnvironment(teamId, dto.environmentId);
        return {
          projectId: environment?.projectId ?? null,
          environmentId: environment?.id ?? null,
        };
      }

      return {
        projectId: hasProject ? (dto.projectId ?? null) : null,
        environmentId: null,
      };
    }

    return {
      projectId: dto.projectId ?? null,
      environmentId: currentScope.environmentId,
    };
  }

  async resolveEnvironmentAccessScope(teamId: string, environmentId?: string | null) {
    const environment = await this.resolveProjectEnvironment(teamId, environmentId || undefined);
    return {
      projectId: environment?.projectId ?? null,
      environmentId: environment?.id ?? null,
    };
  }

  async updateResourceBinding(
    teamId: string,
    userId: string,
    resourceId: string,
    dto: UpdateManagedResourceBindingDto,
  ) {
    const resource = await this.getManagedResource(teamId, resourceId);
    const hasProject = this.hasOwn(dto, 'projectId');
    const hasEnvironment = this.hasOwn(dto, 'environmentId');
    const hasServer = this.hasOwn(dto, 'serverId');
    const hasCredential = this.hasOwn(dto, 'credentialId');
    const hasQueryCredential = this.hasOwn(dto, 'queryCredentialId');
    const before = this.buildResourceBindingSnapshot(resource);

    let nextProjectId = resource.projectId;
    let nextEnvironmentId = resource.environmentId;

    if (hasEnvironment) {
      if (dto.environmentId) {
        const environment = await this.resolveProjectEnvironment(teamId, dto.environmentId);
        if (!environment) {
          throw new NotFoundException('项目环境不存在或已归档');
        }
        if (hasProject && dto.projectId && dto.projectId !== environment.projectId) {
          throw new BadRequestException('项目环境不属于指定项目');
        }
        if (hasProject && dto.projectId === null) {
          throw new BadRequestException('绑定环境时不能清空项目');
        }
        nextEnvironmentId = environment.id;
        nextProjectId = environment.projectId;
      } else {
        nextEnvironmentId = null;
        nextProjectId = hasProject ? (dto.projectId ?? null) : null;
      }
    } else if (hasProject) {
      if (resource.environmentId && dto.projectId !== resource.projectId) {
        throw new BadRequestException('资源已绑定环境，调整项目时需要同步改选或清空环境');
      }
      nextProjectId = dto.projectId ?? null;
    }

    if (nextProjectId) {
      await this.ensureProject(teamId, nextProjectId);
    }

    const nextServerId = hasServer ? (dto.serverId ?? null) : resource.serverId;
    if (resource.sourceType === 'server' && !nextServerId) {
      throw new BadRequestException('服务器来源资源必须绑定服务器');
    }
    if (nextServerId) {
      await this.ensureServer(teamId, nextServerId);
    }

    const nextCredentialId = hasCredential ? (dto.credentialId ?? null) : resource.credentialId;
    if (nextCredentialId) {
      await this.ensureTeamCredential(teamId, nextCredentialId);
    }

    const nextQueryCredentialId = hasQueryCredential
      ? (dto.queryCredentialId ?? null)
      : (this.resolveQueryCredentialId(resource) ?? null);
    if (nextQueryCredentialId) {
      await this.ensureTeamCredential(teamId, nextQueryCredentialId);
    }

    if (nextEnvironmentId && nextServerId) {
      const environment = await this.resolveProjectEnvironment(teamId, nextEnvironmentId);
      if (!environment) {
        throw new NotFoundException('项目环境不存在或已归档');
      }
      await this.bindServerToEnvironment(teamId, environment, nextServerId, {
        source: 'resource-control.updateResourceBinding',
        managedResourceId: resource.id,
      });
    }

    const updated = await this.repo.updateManagedResource({
      where: { id: resource.id },
      data: {
        projectId: nextProjectId,
        environmentId: nextEnvironmentId,
        serverId: nextServerId,
        credentialId: nextCredentialId,
        config: hasQueryCredential
          ? toJsonValueUtil(this.mergeQueryCredentialBinding(resource.config, nextQueryCredentialId))
          : undefined,
      },
      include: this.managedResourceInclude(),
    });

    await this.writeResourceBindingAudit(teamId, userId, resource, updated, before, dto.reason);

    return updated;
  }

  async probeResourceConnection(teamId: string, userId: string, resourceId: string, dto: ProbeResourceConnectionDto) {
    const resource = await this.getManagedResource(teamId, resourceId);
    const action = this.buildConnectionProbeAction(resource);
    const credential = await this.resolveResourceQueryCredential(teamId, resource, action);
    const dryRun = dto.dryRun ?? true;
    const params = dto.params || {};
    const authAdapterKey = this.resolveAuthAdapterKey(resource, credential);
    const executionShape = this.resolveConnectionExecutionShape(resource, credential);
    const runCredentialId = this.resolveQueryRunCredentialId(resource, credential);

    const run = await this.repo.createConnectionRun({
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
        targetEndpoint: resource.endpoint,
        authAdapterKey,
        executorKey: executionShape.executorKey,
        adapterKey: executionShape.adapterKey,
        dryRun,
        status: 'running',
        params: toJsonValueUtil(params),
      },
    });

    try {
      const execution = await this.executeConnectionProbe(teamId, userId, resource, credential, run.id, {
        dryRun,
        params,
        authAdapterKey,
      });
      const completed = await this.repo.updateConnectionRun({
        where: { id: run.id },
        data: {
          status: execution.status,
          executorKey: execution.executorKey,
          adapterKey: execution.adapterKey,
          authAdapterKey: execution.authAdapterKey,
          connectionPlan: execution.connectionPlan,
          result: execution.result,
          error: execution.error,
          finishedAt: new Date(),
        },
        include: this.connectionRunInclude(),
      });
      await this.writeResourceConnectionAudit(teamId, userId, resource, completed);
      return completed;
    } catch (error) {
      const failed = await this.repo.updateConnectionRun({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '资源连接探测失败',
          finishedAt: new Date(),
        },
        include: this.connectionRunInclude(),
      });
      await this.writeResourceConnectionAudit(teamId, userId, resource, failed);
      return failed;
    }
  }

  async runResourceQuery(teamId: string, userId: string, resourceId: string, dto: RunResourceQueryDto) {
    const resource = await this.getManagedResource(teamId, resourceId);
    const action = this.buildConnectionProbeAction(resource);
    const credential = await this.resolveResourceQueryCredential(teamId, resource, action);
    const dryRun = dto.dryRun ?? true;
    const params = dto.params || {};
    const queryType = resolveQueryTypeUtil(resource, dto.queryType);
    const query = normalizeResourceQueryUtil(resource, queryType, dto.query, params, asString);
    const authAdapterKey = this.resolveAuthAdapterKey(resource, credential);
    const executionShape = resolveQueryExecutionShapeUtil(resource);
    const runCredentialId = this.resolveQueryRunCredentialId(resource, credential);

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
      ? await this.prisma.teamCredential.findFirst({
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

  private buildConnectionProbeAction(resource: {
    sourceType: string;
    provider: string;
    kind: string;
  }): ResourceActionDefinition {
    const knownActionKey =
      resource.provider === 'docker' && resource.kind === 'docker_container'
        ? 'docker.container.inspect'
        : resource.kind === 'mysql' || resource.kind === 'database'
          ? 'mysql.connection.test'
          : resource.kind === 'redis'
            ? 'redis.connection.ping'
            : resource.provider === 'aliyun-sls'
              ? 'sls.logstores.list'
              : resource.provider === 'tencent-cos'
                ? 'cos.objects.list'
                : 'resource.connection.probe';
    const knownAction = getActionDefinition(knownActionKey);
    if (knownAction) {
      return knownAction;
    }

    return {
      key: knownActionKey,
      name: '连接探测',
      description: '生成资源连接和授权探测计划',
      providers: [resource.provider],
      kinds: [resource.kind],
      sourceTypes: [resource.sourceType],
      executorKey:
        resource.sourceType === 'server'
          ? 'server-executor'
          : resource.sourceType === 'cloud'
            ? 'cloud-sdk'
            : 'direct-db-adapter',
      adapterKey: 'resource-connection-plan',
      mode: 'read',
      risk: 'low',
      dryRunOnly: true,
      requiresConfirmation: false,
    };
  }

  private resolveConnectionExecutionShape(
    resource: { sourceType: string; provider: string },
    credential: ResolvedCredentialRef,
  ) {
    if (resource.sourceType === 'server' && credential.transport === 'ssh') {
      return {
        executorKey: 'server-executor',
        adapterKey: 'resource-connection-plan',
      };
    }
    if (resource.sourceType === 'cloud') {
      return {
        executorKey: 'cloud-sdk',
        adapterKey: `${resource.provider}-connection-plan`,
      };
    }
    return {
      executorKey: 'direct-db-adapter',
      adapterKey: 'direct-db-connection-plan',
    };
  }

  private resolveAuthAdapterKey(resource: { sourceType: string; provider: string }, credential: ResolvedCredentialRef) {
    if (credential.transport === 'direct_db') {
      return credential.credentialType === 'db_redis_readonly'
        ? 'redis-readonly-team-credential'
        : 'mysql-readonly-team-credential';
    }
    if (credential.source === 'server') {
      return 'server-ssh';
    }
    if (credential.source === 'team_credential') {
      return `${resource.provider}-team-credential`;
    }
    if (resource.sourceType === 'cloud') {
      return `${resource.provider}-unbound-credential`;
    }
    return 'direct-db-credential';
  }

  private async resolveResourceQueryCredential(
    teamId: string,
    resource: ManagedResourceForConnection,
    action: ResourceActionDefinition,
  ): Promise<ResolvedCredentialRef> {
    if (requiresDirectQueryCredential(resource)) {
      const queryCredentialId = this.resolveQueryCredentialId(resource);
      const directCredential = queryCredentialId
        ? await this.resolveDirectQueryCredential(teamId, resource, queryCredentialId, action)
        : resource.credentialId
          ? await this.resolveDirectQueryCredential(teamId, resource, resource.credentialId, action, true)
          : null;

      if (directCredential) {
        return directCredential;
      }
    }

    return this.credentialResolver.resolve(teamId, resource, action);
  }

  private async resolveDirectQueryCredential(
    teamId: string,
    resource: ManagedResourceForConnection,
    credentialId: string,
    action: ResourceActionDefinition,
    optional = false,
  ): Promise<ResolvedCredentialRef | null> {
    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: credentialId, teamId },
      select: { id: true, name: true, type: true },
    });

    if (!credential) {
      if (optional) return null;
      throw new NotFoundException('只读查询凭据不存在或不属于当前团队');
    }

    if (!isDirectQueryCredentialType(resource, credential.type)) {
      if (optional) return null;
      throw new BadRequestException('只读查询凭据类型与资源类型不匹配');
    }

    return {
      source: 'team_credential',
      credentialType: credential.type,
      referenceId: credential.id,
      displayName: credential.name,
      transport: 'direct_db',
      redacted: true,
      metadata: {
        credentialName: credential.name,
        credentialType: credential.type,
        provider: resource.provider,
        kind: resource.kind,
        action: action.key,
        secretMaterial: 'kept_in_direct_db_driver_boundary',
      },
    };
  }

  private resolveQueryRunCredentialId(resource: { credentialId: string | null }, credential: ResolvedCredentialRef) {
    return credential.source === 'team_credential' ? (credential.referenceId ?? null) : resource.credentialId;
  }

  private canExecuteDirectDbLiveQuery(
    resource: ManagedResourceForConnection,
    credential: ResolvedCredentialRef,
    queryType: string,
  ) {
    return (
      credential.transport === 'direct_db' &&
      requiresDirectQueryCredential(resource) &&
      (queryType === 'sql' || queryType === 'redis_scan')
    );
  }

  private isLiveQueryConfirmed(params: Record<string, unknown>) {
    return params.confirmLiveRead === true || params.confirmLiveRead === 'true';
  }

  private async executeConnectionProbe(
    teamId: string,
    userId: string,
    resource: ManagedResourceForConnection,
    credential: ResolvedCredentialRef,
    runId: string,
    options: {
      dryRun: boolean;
      params: Record<string, unknown>;
      authAdapterKey: string;
    },
  ): Promise<ResourceConnectionExecutionResult> {
    if (resource.sourceType === 'server' && credential.transport === 'ssh') {
      return this.executeServerConnectionProbe(teamId, userId, resource, credential, runId, options);
    }

    if (resource.sourceType === 'cloud') {
      return this.executeCloudConnectionProbe(resource, credential, runId, options);
    }

    const adapterKey = 'direct-db-connection-plan';
    const error = 'Direct DB credential adapter 尚未启用，当前只记录连接探测边界。';
    return {
      status: 'blocked',
      executorKey: 'direct-db-adapter',
      adapterKey,
      authAdapterKey: options.authAdapterKey,
      connectionPlan: toJsonValueUtil({
        executorKey: 'direct-db-adapter',
        adapterKey,
        operationKey: 'resource.connection.probe',
        dryRun: options.dryRun,
        executable: false,
        target: this.buildConnectionTarget(resource),
        safety: {
          secretsInOutput: 'must_mask_before_persisting',
          liveExecutionDefault: 'blocked_until_direct_db_adapter_ready',
        },
        warnings: [error],
        metadata: {
          resourceConnectionRunId: runId,
          authAdapterKey: options.authAdapterKey,
          credential: credential.metadata,
          params: options.params,
        },
      }),
      result: toJsonValueUtil({
        mode: 'blocked_adapter_missing',
        executed: false,
        nextExecutorBoundary: 'direct_db_driver_adapter',
      }),
      error,
    };
  }

  private async executeServerConnectionProbe(
    teamId: string,
    userId: string,
    resource: ManagedResourceForConnection,
    credential: ResolvedCredentialRef,
    runId: string,
    options: {
      dryRun: boolean;
      params: Record<string, unknown>;
      authAdapterKey: string;
    },
  ): Promise<ResourceConnectionExecutionResult> {
    const { steps, warnings } = this.buildServerConnectionSteps(resource);
    const target = await this.serverExecutorService.resolveTarget(teamId, resource.serverId);
    const execution = await this.serverExecutorService.execute({
      teamId,
      userId,
      operationKey: 'resource.connection.probe',
      adapterKey: 'resource-connection-plan',
      dryRun: options.dryRun,
      target,
      steps,
      warnings,
      blockOnWarnings: true,
      metadata: {
        resourceConnectionRunId: runId,
        resource: this.buildConnectionTarget(resource),
        credential: credential.metadata,
        authAdapterKey: options.authAdapterKey,
        params: options.params,
      },
    });

    return {
      status: this.terminalConnectionStatus(execution.status),
      executorKey: execution.executorKey,
      adapterKey: execution.adapterKey,
      authAdapterKey: options.authAdapterKey,
      connectionPlan: execution.commandPlan,
      result: execution.result,
      error: execution.error,
    };
  }

  private executeCloudConnectionProbe(
    resource: ManagedResourceForConnection,
    credential: ResolvedCredentialRef,
    runId: string,
    options: {
      dryRun: boolean;
      params: Record<string, unknown>;
      authAdapterKey: string;
    },
  ): ResourceConnectionExecutionResult {
    const adapterKey = `${resource.provider}-connection-plan`;
    const hasCredential = credential.source === 'team_credential';
    const status = hasCredential && options.dryRun ? 'completed' : 'blocked';
    const error = !hasCredential
      ? '云资源未绑定 TeamCredential，无法验证 provider 授权。'
      : !options.dryRun
        ? 'Cloud provider SDK live connection probe 尚未启用。'
        : undefined;
    const warnings = [
      ...(!hasCredential ? ['resource has no TeamCredential binding'] : []),
      ...(!options.dryRun ? ['live provider SDK connection probe is disabled'] : []),
    ];

    return {
      status,
      executorKey: 'cloud-sdk',
      adapterKey,
      authAdapterKey: options.authAdapterKey,
      connectionPlan: toJsonValueUtil({
        executorKey: 'cloud-sdk',
        adapterKey,
        operationKey: 'resource.connection.probe',
        dryRun: options.dryRun,
        executable: hasCredential && options.dryRun,
        target: this.buildConnectionTarget(resource),
        auth: {
          adapterKey: options.authAdapterKey,
          credential,
        },
        safety: {
          providerSdkOnly: true,
          arbitraryShell: false,
          secretsInOutput: 'must_mask_before_persisting',
          liveExecutionDefault: 'blocked_until_provider_adapter_ready',
        },
        warnings,
        metadata: {
          resourceConnectionRunId: runId,
          params: options.params,
        },
        sdkCalls: this.sdkCallsForConnectionProbe(resource, options.params),
      }),
      result: toJsonValueUtil({
        mode: options.dryRun ? 'cloud_connection_plan' : 'blocked_live_transport',
        executed: false,
        executorKey: 'cloud-sdk',
        adapterKey,
        authAdapterKey: options.authAdapterKey,
        credential: credential.metadata,
        warnings,
      }),
      error,
    };
  }

  private buildServerConnectionSteps(resource: {
    kind: string;
    provider: string;
    name: string;
    externalId: string;
    config: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
  }) {
    const warnings: string[] = [];
    const containerName = this.resolveContainerName(resource);
    const steps: ServerCommandStep[] = [];

    if (!containerName) {
      warnings.push('未找到可用于连接探测的 Docker 容器名。');
    }

    if (resource.kind === 'docker_container') {
      steps.push({
        key: 'docker-container-inspect',
        label: '检查 Docker 容器可达性',
        command: containerName ? `docker inspect ${containerName}` : '',
        required: true,
        risk: 'low',
        timeoutSeconds: 20,
      });
      return { steps, warnings };
    }

    if (resource.kind === 'mysql' || resource.kind === 'database') {
      steps.push({
        key: 'mysqladmin-ping',
        label: '探测 MySQL 连接',
        command: containerName
          ? `docker exec ${containerName} mysqladmin ping -h 127.0.0.1 -P ${this.resolveResourcePort(resource, 3306)}`
          : '',
        required: true,
        risk: 'low',
        timeoutSeconds: 20,
      });
      return { steps, warnings };
    }

    if (resource.kind === 'redis') {
      steps.push({
        key: 'redis-ping',
        label: '探测 Redis 连接',
        command: containerName ? `docker exec ${containerName} redis-cli PING` : '',
        required: true,
        risk: 'low',
        timeoutSeconds: 20,
      });
      return { steps, warnings };
    }

    warnings.push(`暂不支持 ${resource.provider}/${resource.kind} 的服务器连接探测。`);
    steps.push({
      key: 'unsupported-resource-connection',
      label: '不支持的服务器资源连接探测',
      command: '',
      required: true,
      risk: 'low',
      timeoutSeconds: 20,
    });

    return { steps, warnings };
  }

  private sdkCallsForConnectionProbe(resource: ManagedResourceForConnection, params: Record<string, unknown>) {
    const config = asRecord(resource.config);
    const metadata = asRecord(resource.metadata);
    const region = asString(metadata.region) || asString(params.region) || 'default';

    if (resource.provider === 'aliyun-rds') {
      return [
        {
          provider: 'aliyun-rds',
          operation: 'DescribeDBInstanceAttribute',
          params: {
            region,
            instanceId: resource.externalId.split(':').pop(),
            endpoint: resource.endpoint,
          },
        },
      ];
    }

    if (resource.provider === 'aliyun-sls') {
      return [
        {
          provider: 'aliyun-sls',
          operation: 'ListLogStores',
          params: {
            region,
            project: asString(config.project) || resource.name,
          },
        },
      ];
    }

    if (resource.provider === 'tencent-cos') {
      return [
        {
          provider: 'tencent-cos',
          operation: 'HeadBucket',
          params: {
            region,
            bucket: asString(config.bucket) || resource.name,
          },
        },
      ];
    }

    return [
      {
        provider: resource.provider,
        operation: 'ConnectionProbe',
        params: {
          region,
          resourceId: resource.externalId,
        },
      },
    ];
  }

  private buildConnectionTarget(resource: {
    id: string;
    name: string;
    sourceType: string;
    provider: string;
    kind: string;
    endpoint: string | null;
    externalId: string;
    serverId: string | null;
    credentialId: string | null;
  }) {
    return {
      resourceId: resource.id,
      resourceName: resource.name,
      sourceType: resource.sourceType,
      provider: resource.provider,
      kind: resource.kind,
      endpoint: resource.endpoint,
      externalId: resource.externalId,
      serverId: resource.serverId,
      credentialId: resource.credentialId,
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
    const validation = this.validateReadOnlyQuery(options.queryType, options.query);
    const missingCredential = resource.sourceType === 'cloud' && credential.source !== 'team_credential';
    const directDbLiveQuery = this.canExecuteDirectDbLiveQuery(resource, credential, options.queryType);
    const liveMissingConfirmation = !options.dryRun && directDbLiveQuery && !this.isLiveQueryConfirmed(options.params);
    const liveUnsupported = !options.dryRun && !directDbLiveQuery;
    const plannedCalls = this.plannedCallsForQuery(resource, options.queryType, options.query, options.params);
    const resultContract = this.queryResultContract(options.queryType);
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
      target: this.buildConnectionTarget(resource),
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

  private queryResultContract(queryType: string) {
    if (queryType === 'sql') {
      return {
        shape: 'table',
        columns: [
          { key: 'column', label: 'Column', type: 'string', masked: false },
          { key: 'value', label: 'Value', type: 'string', masked: false },
        ],
        rowLimitDefault: 100,
        rowLimitMax: 1000,
      };
    }

    if (queryType === 'redis_scan') {
      return {
        shape: 'table',
        columns: [
          { key: 'cursor', label: 'Cursor', type: 'string', masked: false },
          { key: 'key', label: 'Key', type: 'string', masked: true },
          { key: 'type', label: 'Type', type: 'string', masked: false },
          { key: 'ttl', label: 'TTL', type: 'number', masked: false },
        ],
        rowLimitDefault: 100,
        rowLimitMax: 1000,
      };
    }

    if (queryType === 'sls_query') {
      return {
        shape: 'table',
        columns: [
          { key: 'time', label: 'Time', type: 'datetime', masked: false },
          { key: 'level', label: 'Level', type: 'string', masked: false },
          { key: 'message', label: 'Message', type: 'string', masked: true },
        ],
        rowLimitDefault: 100,
        rowLimitMax: 1000,
      };
    }

    if (queryType === 'cos_list') {
      return {
        shape: 'table',
        columns: [
          { key: 'key', label: 'Object Key', type: 'string', masked: false },
          { key: 'size', label: 'Size', type: 'number', masked: false },
          {
            key: 'lastModified',
            label: 'Last Modified',
            type: 'datetime',
            masked: false,
          },
          {
            key: 'storageClass',
            label: 'Storage Class',
            type: 'string',
            masked: false,
          },
        ],
        rowLimitDefault: 100,
        rowLimitMax: 1000,
      };
    }

    return {
      shape: 'key_value',
      columns: [
        { key: 'field', label: 'Field', type: 'string', masked: false },
        { key: 'value', label: 'Value', type: 'string', masked: true },
      ],
      rowLimitDefault: 100,
      rowLimitMax: 1000,
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
      rows: rows.map((row) => this.maskQueryPreviewRow(row, redaction.secretKeyPatterns)),
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

  private maskQueryPreviewRow(row: Record<string, unknown>, secretPatterns: string[]) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const shouldMask = secretPatterns.some((pattern) => key.toLowerCase().includes(pattern.toLowerCase()));
        return [key, shouldMask ? '******' : value];
      }),
    );
  }

  private validateReadOnlyQuery(queryType: string, query: string) {
    const cleanQuery = queryType === 'sql' ? this.stripSqlComments(query) : query;
    const normalized = cleanQuery.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!normalized) {
      return { ok: false, reason: '查询不能为空' };
    }

    if (queryType === 'sql') {
      if (/;.*\S/.test(normalized)) {
        return { ok: false, reason: 'SQL 查询计划只允许单条只读语句' };
      }
      if (this.hasForbiddenSqlReadonlyPattern(normalized)) {
        return {
          ok: false,
          reason: 'SQL 只读查询不允许写入、锁、文件、过程或高风险函数',
        };
      }
      if (/^select\b/.test(normalized)) {
        return { ok: true, reason: 'read-only sql' };
      }
      if (/^(show|describe|desc)\b/.test(normalized)) {
        return { ok: true, reason: 'read-only sql metadata' };
      }
      if (/^explain\s+(format\s*=\s*(json|tree|traditional)\s+)?select\b/.test(normalized)) {
        return { ok: true, reason: 'read-only sql' };
      }
      return {
        ok: false,
        reason: 'SQL 查询计划只允许 SELECT/SHOW/DESCRIBE/EXPLAIN',
      };
    }

    if (queryType === 'redis_scan') {
      if (/^(scan|info|ping|ttl|type|exists)\b/.test(normalized)) {
        return { ok: true, reason: 'read-only redis command' };
      }
      return {
        ok: false,
        reason: 'Redis 查询计划只允许 SCAN/INFO/PING/TTL/TYPE/EXISTS',
      };
    }

    if (queryType === 'sls_query' || queryType === 'cos_list' || queryType === 'metadata') {
      return { ok: true, reason: 'provider read operation' };
    }

    return { ok: false, reason: `不支持的查询类型: ${queryType}` };
  }

  private stripSqlComments(query: string) {
    return query
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\n\r]*/g, ' ')
      .replace(/#[^\n\r]*/g, ' ');
  }

  private hasForbiddenSqlReadonlyPattern(normalizedSql: string) {
    return (
      /\b(insert|update|delete|drop|alter|create|truncate|replace|merge|grant|revoke|call|do|set|use|lock|unlock|analyze|optimize|repair|kill|load)\b/.test(
        normalizedSql,
      ) ||
      /\binto\s+(outfile|dumpfile)\b/.test(normalizedSql) ||
      /\bfor\s+update\b/.test(normalizedSql) ||
      /\block\s+in\s+share\s+mode\b/.test(normalizedSql) ||
      /\b(get_lock|release_lock|sleep|benchmark)\s*\(/.test(normalizedSql)
    );
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

  private async writeResourceConnectionAudit(
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
    connectionRun: {
      id: string;
      status: string;
      dryRun: boolean;
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
      resourceConnectionRunId: connectionRun.id,
      category: 'resource_connection',
      action: 'resource.connection.probe',
      targetType: 'managed_resource',
      targetId: resource.id,
      risk: 'low',
      status: connectionRun.status,
      summary: `资源连接探测 ${resource.name} ${connectionRun.status}`,
      metadata: {
        dryRun: connectionRun.dryRun,
        sourceType: resource.sourceType,
        provider: resource.provider,
        kind: resource.kind,
        endpoint: resource.endpoint,
        resourceName: resource.name,
        executorKey: connectionRun.executorKey,
        adapterKey: connectionRun.adapterKey,
        authAdapterKey: connectionRun.authAdapterKey,
        error: connectionRun.error,
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
    const credential = await this.prisma.teamCredential.findFirst({
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

  private resolveContainerName(resource: {
    name: string;
    externalId: string;
    config: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
  }) {
    const config = asRecord(resource.config);
    const metadata = asRecord(resource.metadata);
    const rawName =
      asString(config.containerName) ||
      asString(metadata.containerName) ||
      resource.name.split('/').pop()?.trim() ||
      resource.externalId.split(':').pop() ||
      resource.name;

    return this.sanitizeDockerName(rawName);
  }

  private resolveResourcePort(resource: { config: Prisma.JsonValue | null }, fallback: number) {
    const config = asRecord(resource.config);
    const port = config.port;
    if (typeof port === 'number' && Number.isFinite(port)) {
      return Math.max(1, Math.min(Math.floor(port), 65535));
    }
    if (typeof port === 'string') {
      const parsed = Number(port);
      if (Number.isFinite(parsed)) {
        return Math.max(1, Math.min(Math.floor(parsed), 65535));
      }
    }
    return fallback;
  }

  private sanitizeDockerName(value?: string) {
    const trimmed = value?.trim() || '';
    if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(trimmed)) {
      return trimmed;
    }
    return trimmed.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 128) || '';
  }

  private terminalConnectionStatus(status: string): ResourceConnectionExecutionResult['status'] {
    return status === 'queued' ? 'blocked' : (status as ResourceConnectionExecutionResult['status']);
  }
}
