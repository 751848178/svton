import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
import { ResourceControlService } from './resource-control.service';
import { ResourceControlAccessPolicyService, ResourceControlAuthRequest } from './resource-control-access-policy.service';

const CONTROLLER_GUARDS = [JwtAuthGuard, AuthzGuard] as const;

@Controller('resource-control')
@UseGuards(...CONTROLLER_GUARDS)
@Roles('team_member')
export class ResourceControlReadController {
  constructor(
    private readonly resourceControlService: ResourceControlService,
    private readonly accessPolicy: ResourceControlAccessPolicyService,
  ) {}

  @Get('capabilities')
  getCapabilities() {
    return this.resourceControlService.getCapabilities();
  }

  @Get('resources')
  async listResources(@Request() req: ResourceControlAuthRequest, @Query() query: ListManagedResourcesQueryDto) {
    const resources = await this.resourceControlService.listResources(req.teamId, query);
    return this.accessPolicy.filterReadableResourceRecords(req, resources, 'resource.read', 'managed_resource');
  }

  @Get('actions')
  async listActions(@Request() req: ResourceControlAuthRequest, @Query() query: ListResourceActionsQueryDto) {
    if (query.resourceId) {
      const scope = await this.resourceControlService.getResourceAccessScope(req.teamId, query.resourceId);
      await this.accessPolicy.assertCanReadResource(req, 'resource.actions.read', query.resourceId, scope.projectId, scope.environmentId, 'managed_resource');
    }
    return this.resourceControlService.listActions(req.teamId, query);
  }

  @Get('sync-runs')
  async listSyncRuns(@Request() req: ResourceControlAuthRequest) {
    const runs = await this.resourceControlService.listSyncRuns(req.teamId);
    return this.accessPolicy.filterReadableResourceRecords(req, runs, 'resource_sync_run.read', 'resource_sync_run');
  }

  @Get('cloud/provider-health')
  async listCloudProviderHealth(@Request() req: ResourceControlAuthRequest) {
    const runs = await this.resourceControlService.listCloudProviderHealthRuns(req.teamId);
    const readableRuns = await this.accessPolicy.filterReadableResourceRecords(req, runs, 'resource_sync_run.read', 'resource_sync_run');
    return this.resourceControlService.summarizeCloudProviderHealth(readableRuns);
  }

  @Get('action-runs')
  async listActionRuns(@Request() req: ResourceControlAuthRequest, @Query() query: ListResourceActionRunsQueryDto) {
    const runs = await this.resourceControlService.listActionRuns(req.teamId, query);
    return this.accessPolicy.filterReadableResourceRecords(req, runs, 'resource_action_run.read', 'resource_action_run');
  }

  @Get('connection-runs')
  async listConnectionRuns(@Request() req: ResourceControlAuthRequest, @Query() query: ListResourceConnectionRunsQueryDto) {
    const runs = await this.resourceControlService.listConnectionRuns(req.teamId, query);
    return this.accessPolicy.filterReadableResourceRecords(req, runs, 'resource_connection_run.read', 'resource_connection_run');
  }

  @Get('metric-snapshots')
  async listMetricSnapshots(@Request() req: ResourceControlAuthRequest, @Query() query: ListResourceMetricSnapshotsQueryDto) {
    const snapshots = await this.resourceControlService.listMetricSnapshots(req.teamId, query);
    return this.accessPolicy.filterReadableResourceRecords(req, snapshots, 'resource_metric_snapshot.read', 'resource_metric_snapshot');
  }

  @Get('metric-trends')
  async listMetricTrends(@Request() req: ResourceControlAuthRequest, @Query() query: ListResourceMetricTrendsQueryDto) {
    const trends = await this.resourceControlService.listMetricTrends(req.teamId, query);
    return this.accessPolicy.filterReadableResourceRecords(req, trends, 'resource_metric_trend.read', 'resource_metric_trend');
  }

  @Get('metric-series')
  async listMetricSeries(@Request() req: ResourceControlAuthRequest, @Query() query: ListResourceMetricSeriesQueryDto) {
    const series = await this.resourceControlService.listMetricSeries(req.teamId, query);
    return this.accessPolicy.filterReadableResourceRecords(req, series, 'resource_metric_series.read', 'resource_metric_series');
  }

  @Get('query-runs')
  async listQueryRuns(@Request() req: ResourceControlAuthRequest, @Query() query: ListResourceQueryRunsQueryDto) {
    const runs = await this.resourceControlService.listQueryRuns(req.teamId, query);
    return this.accessPolicy.filterReadableResourceRecords(req, runs, 'resource_query_run.read', 'resource_query_run');
  }
}

@Controller('resource-control')
@UseGuards(...CONTROLLER_GUARDS)
@Roles('team_member')
export class ResourceControlWriteController {
  constructor(
    private readonly resourceControlService: ResourceControlService,
    private readonly accessPolicy: ResourceControlAccessPolicyService,
  ) {}

  @Post('resources/:resourceId/actions')
  async executeResourceAction(@Request() req: ResourceControlAuthRequest, @Param('resourceId') resourceId: string, @Body() dto: ExecuteResourceActionDto) {
    const scope = await this.resourceControlService.getResourceAccessScope(req.teamId, resourceId);
    await this.accessPolicy.assertCanWriteResource(req, 'resource.action', resourceId, scope.projectId, scope.environmentId, dto.dryRun === false ? 'high' : 'medium', dto.action);
    return this.resourceControlService.executeResourceAction(req.teamId, req.user.id, resourceId, dto);
  }

  @Put('resources/:resourceId/binding')
  async updateResourceBinding(@Request() req: ResourceControlAuthRequest, @Param('resourceId') resourceId: string, @Body() dto: UpdateManagedResourceBindingDto) {
    const currentScope = await this.resourceControlService.getResourceAccessScope(req.teamId, resourceId);
    const targetScope = await this.resourceControlService.resolveResourceBindingTargetAccessScope(req.teamId, resourceId, dto);
    await this.accessPolicy.assertCanWriteResource(req, 'resource.binding.update', resourceId, currentScope.projectId, currentScope.environmentId, 'medium');
    if (targetScope.projectId !== currentScope.projectId || targetScope.environmentId !== currentScope.environmentId) {
      await this.accessPolicy.assertCanWriteResource(req, 'resource.binding.update', resourceId, targetScope.projectId, targetScope.environmentId, 'medium');
    }
    return this.resourceControlService.updateResourceBinding(req.teamId, req.user.id, resourceId, dto);
  }

  @Post('resources/:resourceId/connection-probe')
  async probeResourceConnection(@Request() req: ResourceControlAuthRequest, @Param('resourceId') resourceId: string, @Body() dto: ProbeResourceConnectionDto) {
    const scope = await this.resourceControlService.getResourceAccessScope(req.teamId, resourceId);
    await this.accessPolicy.assertCanWriteResource(req, 'resource.connection_probe', resourceId, scope.projectId, scope.environmentId, dto.dryRun === false ? 'medium' : 'low');
    return this.resourceControlService.probeResourceConnection(req.teamId, req.user.id, resourceId, dto);
  }

  @Post('resources/:resourceId/query-runs')
  async runResourceQuery(@Request() req: ResourceControlAuthRequest, @Param('resourceId') resourceId: string, @Body() dto: RunResourceQueryDto) {
    const scope = await this.resourceControlService.getResourceAccessScope(req.teamId, resourceId);
    await this.accessPolicy.assertCanWriteResource(req, 'resource.query', resourceId, scope.projectId, scope.environmentId, dto.dryRun === false ? 'medium' : 'low');
    return this.resourceControlService.runResourceQuery(req.teamId, req.user.id, resourceId, dto);
  }

  @Post('servers/:serverId/sync-docker')
  async syncServerDocker(@Request() req: ResourceControlAuthRequest, @Param('serverId') serverId: string, @Body() dto: SyncServerDockerDto) {
    const scope = await this.resourceControlService.resolveEnvironmentAccessScope(req.teamId, dto.environmentId);
    await this.accessPolicy.assertCanSyncDocker(req, serverId, scope.projectId, scope.environmentId);
    return this.resourceControlService.syncServerDocker(req.teamId, req.user.id, serverId, dto);
  }

  @Post('cloud/sync')
  async syncCloudResources(@Request() req: ResourceControlAuthRequest, @Body() dto: SyncCloudResourcesDto) {
    const scope = await this.resourceControlService.resolveEnvironmentAccessScope(req.teamId, dto.environmentId);
    await this.accessPolicy.assertCanSyncCloud(req, dto.provider, scope.projectId, scope.environmentId);
    return this.resourceControlService.syncCloudResources(req.teamId, req.user.id, dto);
  }
}
