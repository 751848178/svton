/**
 * ResourceControlService — public facade.
 *
 * Thin delegation layer over the focused resource-control services:
 * - ResourceControlListReadService (list endpoints + access-scope)
 * - ResourceControlBindingService (resource binding update + lookups)
 * - ResourceControlConnectionSharedService (credential/auth/probe-action resolution)
 * - ResourceControlConnectionProbeService (connection probe execution)
 * - ResourceControlResourceQueryService (resource query execution)
 * - ResourceControlActionService (resource action execution)
 * - ResourceControlMetricsService (docker metric snapshot persistence)
 * - ResourceControlSyncService (docker + cloud inventory sync)
 *
 * This facade preserves the original public API consumed by the controller and
 * scheduler; all behavior lives in the focused services. No business logic here.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlListReadService } from './resource-control-list-read.service';
import { ResourceControlBindingService } from './resource-control-binding.service';
import { ResourceControlConnectionSharedService } from './resource-control-connection-shared.service';
import { ResourceControlConnectionProbeService } from './resource-control-connection-probe.service';
import { ResourceControlResourceQueryService } from './resource-control-query.service';
import { ResourceControlActionService } from './resource-control-action.service';
import { ResourceControlMetricsService } from './resource-control-metrics.service';
import { ResourceControlSyncService } from './resource-control-sync.service';
import { ResourceControlCapabilitiesService } from './resource-control-capabilities.service';
import { ResourceControlCloudProviderHealthService } from './resource-control-cloud-provider-health.service';
import { CloudProviderHealthRun } from './resource-control-cloud-provider-health.types';
import {
  ExecuteResourceActionDto, ListResourceActionsQueryDto, ListResourceActionRunsQueryDto,
  ListResourceConnectionRunsQueryDto, ListResourceMetricSeriesQueryDto, ListResourceMetricSnapshotsQueryDto,
  ListResourceMetricTrendsQueryDto, ListResourceQueryRunsQueryDto, ListManagedResourcesQueryDto,
  ProbeResourceConnectionDto, RunResourceQueryDto, SyncCloudResourcesDto, SyncServerDockerDto,
  UpdateManagedResourceBindingDto,
} from './dto/resource-control.dto';

@Injectable()
export class ResourceControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listRead: ResourceControlListReadService,
    private readonly binding: ResourceControlBindingService,
    private readonly connectionProbe: ResourceControlConnectionProbeService,
    private readonly resourceQuery: ResourceControlResourceQueryService,
    private readonly action: ResourceControlActionService,
    private readonly sync: ResourceControlSyncService,
    private readonly capabilitiesService: ResourceControlCapabilitiesService = new ResourceControlCapabilitiesService(),
    private readonly cloudProviderHealthService: ResourceControlCloudProviderHealthService = new ResourceControlCloudProviderHealthService(prisma),
  ) {}

  getCapabilities = () => this.capabilitiesService.getCapabilities();
  listActions = (teamId: string, query: ListResourceActionsQueryDto) => this.listRead.listActions(teamId, query);
  listResources = (teamId: string, query: ListManagedResourcesQueryDto) => this.listRead.listResources(teamId, query);
  listSyncRuns = (teamId: string) => this.listRead.listSyncRuns(teamId);
  listCloudProviderHealthRuns = (teamId: string) => this.listRead.listCloudProviderHealthRuns(teamId);
  summarizeCloudProviderHealth = (runs: CloudProviderHealthRun[]) => this.listRead.summarizeCloudProviderHealth(runs);
  listActionRuns = (teamId: string, query: ListResourceActionRunsQueryDto) => this.listRead.listActionRuns(teamId, query);
  listMetricSnapshots = (teamId: string, query: ListResourceMetricSnapshotsQueryDto) => this.listRead.listMetricSnapshots(teamId, query);
  listMetricTrends = (teamId: string, query: ListResourceMetricTrendsQueryDto) => this.listRead.listMetricTrends(teamId, query);
  listMetricSeries = (teamId: string, query: ListResourceMetricSeriesQueryDto) => this.listRead.listMetricSeries(teamId, query);
  listConnectionRuns = (teamId: string, query: ListResourceConnectionRunsQueryDto) => this.listRead.listConnectionRuns(teamId, query);
  listQueryRuns = (teamId: string, query: ListResourceQueryRunsQueryDto) => this.listRead.listQueryRuns(teamId, query);
  getResourceAccessScope = (teamId: string, resourceId: string) => this.listRead.getResourceAccessScope(teamId, resourceId);
  resolveResourceBindingTargetAccessScope = (teamId: string, resourceId: string, dto: UpdateManagedResourceBindingDto) => this.listRead.resolveResourceBindingTargetAccessScope(teamId, resourceId, dto);
  resolveEnvironmentAccessScope = (teamId: string, environmentId?: string | null) => this.listRead.resolveEnvironmentAccessScope(teamId, environmentId);
  updateResourceBinding = (teamId: string, userId: string, resourceId: string, dto: UpdateManagedResourceBindingDto) => this.binding.updateResourceBinding(teamId, userId, resourceId, dto);
  probeResourceConnection = (teamId: string, userId: string, resourceId: string, dto: ProbeResourceConnectionDto) => this.connectionProbe.probeResourceConnection(teamId, userId, resourceId, dto);
  runResourceQuery = (teamId: string, userId: string, resourceId: string, dto: RunResourceQueryDto) => this.resourceQuery.runResourceQuery(teamId, userId, resourceId, dto);
  executeResourceAction = (teamId: string, userId: string | null, resourceId: string, dto: ExecuteResourceActionDto) => this.action.executeResourceAction(teamId, userId, resourceId, dto);
  syncServerDocker = (teamId: string, userId: string | null, serverId: string, dto: SyncServerDockerDto) => this.sync.syncServerDocker(teamId, userId, serverId, dto);
  syncCloudResources = (teamId: string, userId: string, dto: SyncCloudResourcesDto) => this.sync.syncCloudResources(teamId, userId, dto);
}
