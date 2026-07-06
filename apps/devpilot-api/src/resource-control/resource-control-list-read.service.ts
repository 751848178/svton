/**
 * Resource-control list-read + access-scope service.
 *
 * Owns the read-only list endpoints (resources, sync/action/connection/query
 * runs, metric snapshots/trends/series, cloud-provider health runs/actions)
 * and the row-level access-scope resolvers consumed by the controller's
 * access-policy checks. Extracted from `ResourceControlService` so the facade
 * stops carrying read-side orchestration. Behavior preserved verbatim.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlCloudProviderHealthService } from './resource-control-cloud-provider-health.service';
import { CloudProviderHealthRun } from './resource-control-cloud-provider-health.types';
import {
  actionRunInclude,
  connectionRunInclude,
  managedResourceInclude,
  metricSnapshotInclude,
  queryRunInclude,
} from './resource-control-includes.constants';
import {
  buildManagedResourceWhere,
  buildResourceActionRunWhere,
  buildResourceConnectionRunWhere,
  buildResourceMetricSnapshotWhere,
  buildResourceQueryRunWhere,
} from './resource-control-query.utils';
import {
  getActionsForResource,
  RESOURCE_ACTIONS,
} from './actions/resource-actions';
import {
  ListResourceActionsQueryDto,
  ListResourceActionRunsQueryDto,
  ListResourceConnectionRunsQueryDto,
  ListResourceMetricSeriesQueryDto,
  ListResourceMetricSnapshotsQueryDto,
  ListResourceMetricTrendsQueryDto,
  ListResourceQueryRunsQueryDto,
  ListManagedResourcesQueryDto,
  UpdateManagedResourceBindingDto,
} from './dto/resource-control.dto';
import {
  parseMetricSeriesLimit as parseMetricSeriesLimitUtil,
  parseMetricSeriesMetric as parseMetricSeriesMetricUtil,
  parseMetricTrendWindowMinutes as parseMetricTrendWindowMinutesUtil,
} from './resource-control-metrics.utils';
import {
  buildMetricSeries as buildMetricSeriesUtil,
  summarizeMetricTrends as summarizeMetricTrendsUtil,
} from './resource-control-metric-summary.utils';

type EnvironmentRef = { id: string; projectId: string; key: string; name: string };

@Injectable()
export class ResourceControlListReadService {
  constructor(
    private readonly repo: ResourceControlRepository,
    private readonly cloudProviderHealthService: ResourceControlCloudProviderHealthService,
  ) {}

  async listActions(teamId: string, query: ListResourceActionsQueryDto) {
    if (!query.resourceId) {
      return RESOURCE_ACTIONS;
    }
    const resource = await this.getManagedResource(teamId, query.resourceId);
    return getActionsForResource(resource);
  }

  listResources = (teamId: string, query: ListManagedResourcesQueryDto) =>
    this.repo.findManagedResources({
      where: buildManagedResourceWhere(teamId, query),
      orderBy: [{ sourceType: 'asc' }, { provider: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
      include: managedResourceInclude,
    });

  listSyncRuns = (teamId: string) =>
    this.repo.findSyncRuns({
      where: { teamId }, orderBy: { startedAt: 'desc' }, take: 20,
      include: {
        server: { select: { id: true, name: true, host: true } },
        credential: { select: { id: true, name: true, type: true } },
        actor: { select: { id: true, name: true, email: true } },
      },
    });

  listCloudProviderHealthRuns = (teamId: string) => this.cloudProviderHealthService.listRuns(teamId);
  summarizeCloudProviderHealth = (runs: CloudProviderHealthRun[]) => this.cloudProviderHealthService.summarize(runs);

  listActionRuns = (teamId: string, query: ListResourceActionRunsQueryDto) =>
    this.repo.findActionRuns({
      where: buildResourceActionRunWhere(teamId, query), orderBy: { startedAt: 'desc' }, take: 30,
      include: actionRunInclude,
    });

  listMetricSnapshots = (teamId: string, query: ListResourceMetricSnapshotsQueryDto) =>
    this.repo.findMetricSnapshots({
      where: buildResourceMetricSnapshotWhere(teamId, query), orderBy: { sampledAt: 'desc' }, take: 100,
      include: metricSnapshotInclude,
    });

  async listMetricTrends(teamId: string, query: ListResourceMetricTrendsQueryDto) {
    const windowMinutes = parseMetricTrendWindowMinutesUtil(query.windowMinutes);
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const snapshots = await this.repo.findMetricSnapshots({
      where: buildResourceMetricSnapshotWhere(teamId, query, cutoff), orderBy: { sampledAt: 'desc' }, take: 500,
      include: metricSnapshotInclude,
    });
    return summarizeMetricTrendsUtil(snapshots, windowMinutes);
  }

  async listMetricSeries(teamId: string, query: ListResourceMetricSeriesQueryDto) {
    const windowMinutes = parseMetricTrendWindowMinutesUtil(query.windowMinutes || '360');
    const limit = parseMetricSeriesLimitUtil(query.limit);
    const metric = parseMetricSeriesMetricUtil(query.metric);
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const snapshots = await this.repo.findMetricSnapshots({
      where: buildResourceMetricSnapshotWhere(teamId, query, cutoff), orderBy: { sampledAt: 'desc' }, take: limit,
      include: metricSnapshotInclude,
    });
    return buildMetricSeriesUtil(snapshots, metric, windowMinutes, limit);
  }

  listConnectionRuns = (teamId: string, query: ListResourceConnectionRunsQueryDto) =>
    this.repo.findConnectionRuns({
      where: buildResourceConnectionRunWhere(teamId, query), orderBy: { startedAt: 'desc' }, take: 50,
      include: connectionRunInclude,
    });

  listQueryRuns = (teamId: string, query: ListResourceQueryRunsQueryDto) =>
    this.repo.findQueryRuns({
      where: buildResourceQueryRunWhere(teamId, query), orderBy: { startedAt: 'desc' }, take: 50,
      include: queryRunInclude,
    });

  async getResourceAccessScope(teamId: string, resourceId: string) {
    const resource = await this.getManagedResource(teamId, resourceId);
    return { projectId: resource.projectId, environmentId: resource.environmentId };
  }

  async resolveResourceBindingTargetAccessScope(
    teamId: string, resourceId: string, dto: UpdateManagedResourceBindingDto,
  ) {
    const currentScope = await this.getResourceAccessScope(teamId, resourceId);
    const hasProject = Object.prototype.hasOwnProperty.call(dto, 'projectId');
    const hasEnvironment = Object.prototype.hasOwnProperty.call(dto, 'environmentId');

    if (!hasProject && !hasEnvironment) return currentScope;

    if (hasEnvironment) {
      if (dto.environmentId) {
        const environment = await this.resolveProjectEnvironment(teamId, dto.environmentId);
        return { projectId: environment?.projectId ?? null, environmentId: environment?.id ?? null };
      }
      return { projectId: hasProject ? (dto.projectId ?? null) : null, environmentId: null };
    }
    return { projectId: dto.projectId ?? null, environmentId: currentScope.environmentId };
  }

  async resolveEnvironmentAccessScope(teamId: string, environmentId?: string | null) {
    const environment = await this.resolveProjectEnvironment(teamId, environmentId || undefined);
    return { projectId: environment?.projectId ?? null, environmentId: environment?.id ?? null };
  }

  async getManagedResource(teamId: string, resourceId: string) {
    const resource = await this.repo.findManagedResource({
      where: { id: resourceId, teamId }, include: managedResourceInclude,
    });
    if (!resource) throw new NotFoundException('托管资源不存在');
    return resource;
  }

  private async resolveProjectEnvironment(teamId: string, environmentId?: string): Promise<EnvironmentRef | null> {
    if (!environmentId) return null;
    const environment = await this.repo.findProjectEnvironment({
      where: { id: environmentId, teamId, status: 'active' },
      select: { id: true, projectId: true, key: true, name: true },
    });
    if (!environment) throw new NotFoundException('项目环境不存在或已归档');
    return environment;
  }
}
