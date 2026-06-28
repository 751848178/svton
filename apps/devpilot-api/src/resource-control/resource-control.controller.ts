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
import { ControlAccessPolicyService } from '../control-access-policy';
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

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableResourceRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
  resource?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
  metadata?: unknown;
};

@Controller('resource-control')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ResourceControlController {
  constructor(
    private readonly resourceControlService: ResourceControlService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get('capabilities')
  getCapabilities() {
    return this.resourceControlService.getCapabilities();
  }

  @Get('resources')
  async listResources(
    @Request() req: AuthRequest,
    @Query() query: ListManagedResourcesQueryDto,
  ) {
    const resources = await this.resourceControlService.listResources(req.teamId, query);
    return this.filterReadableResourceRecords(req, resources, 'resource.read', 'managed_resource');
  }

  @Get('actions')
  async listActions(
    @Request() req: AuthRequest,
    @Query() query: ListResourceActionsQueryDto,
  ) {
    if (query.resourceId) {
      const scope = await this.resourceControlService.getResourceAccessScope(req.teamId, query.resourceId);
      await this.assertCanReadResource(
        req,
        'resource.actions.read',
        query.resourceId,
        scope.projectId,
        scope.environmentId,
        'managed_resource',
      );
    }
    return this.resourceControlService.listActions(req.teamId, query);
  }

  @Get('sync-runs')
  async listSyncRuns(@Request() req: AuthRequest) {
    const runs = await this.resourceControlService.listSyncRuns(req.teamId);
    return this.filterReadableResourceRecords(req, runs, 'resource_sync_run.read', 'resource_sync_run');
  }

  @Get('cloud/provider-health')
  async listCloudProviderHealth(@Request() req: AuthRequest) {
    const runs = await this.resourceControlService.listCloudProviderHealthRuns(req.teamId);
    const readableRuns = await this.filterReadableResourceRecords(
      req,
      runs,
      'resource_sync_run.read',
      'resource_sync_run',
    );
    return this.resourceControlService.summarizeCloudProviderHealth(readableRuns);
  }

  @Get('action-runs')
  async listActionRuns(
    @Request() req: AuthRequest,
    @Query() query: ListResourceActionRunsQueryDto,
  ) {
    const runs = await this.resourceControlService.listActionRuns(req.teamId, query);
    return this.filterReadableResourceRecords(req, runs, 'resource_action_run.read', 'resource_action_run');
  }

  @Get('connection-runs')
  async listConnectionRuns(
    @Request() req: AuthRequest,
    @Query() query: ListResourceConnectionRunsQueryDto,
  ) {
    const runs = await this.resourceControlService.listConnectionRuns(req.teamId, query);
    return this.filterReadableResourceRecords(req, runs, 'resource_connection_run.read', 'resource_connection_run');
  }

  @Get('metric-snapshots')
  async listMetricSnapshots(
    @Request() req: AuthRequest,
    @Query() query: ListResourceMetricSnapshotsQueryDto,
  ) {
    const snapshots = await this.resourceControlService.listMetricSnapshots(req.teamId, query);
    return this.filterReadableResourceRecords(req, snapshots, 'resource_metric_snapshot.read', 'resource_metric_snapshot');
  }

  @Get('metric-trends')
  async listMetricTrends(
    @Request() req: AuthRequest,
    @Query() query: ListResourceMetricTrendsQueryDto,
  ) {
    const trends = await this.resourceControlService.listMetricTrends(req.teamId, query);
    return this.filterReadableResourceRecords(req, trends, 'resource_metric_trend.read', 'resource_metric_trend');
  }

  @Get('metric-series')
  async listMetricSeries(
    @Request() req: AuthRequest,
    @Query() query: ListResourceMetricSeriesQueryDto,
  ) {
    const series = await this.resourceControlService.listMetricSeries(req.teamId, query);
    return this.filterReadableResourceRecords(req, series, 'resource_metric_series.read', 'resource_metric_series');
  }

  @Get('query-runs')
  async listQueryRuns(
    @Request() req: AuthRequest,
    @Query() query: ListResourceQueryRunsQueryDto,
  ) {
    const runs = await this.resourceControlService.listQueryRuns(req.teamId, query);
    return this.filterReadableResourceRecords(req, runs, 'resource_query_run.read', 'resource_query_run');
  }

  @Post('resources/:resourceId/actions')
  async executeResourceAction(
    @Request() req: AuthRequest,
    @Param('resourceId') resourceId: string,
    @Body() dto: ExecuteResourceActionDto,
  ) {
    const scope = await this.resourceControlService.getResourceAccessScope(req.teamId, resourceId);
    await this.assertCanWriteResource(
      req,
      'resource.action',
      resourceId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'high' : 'medium',
      dto.action,
    );
    return this.resourceControlService.executeResourceAction(
      req.teamId,
      req.user.id,
      resourceId,
      dto,
    );
  }

  @Put('resources/:resourceId/binding')
  async updateResourceBinding(
    @Request() req: AuthRequest,
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateManagedResourceBindingDto,
  ) {
    const currentScope = await this.resourceControlService.getResourceAccessScope(req.teamId, resourceId);
    const targetScope = await this.resourceControlService.resolveResourceBindingTargetAccessScope(
      req.teamId,
      resourceId,
      dto,
    );
    await this.assertCanWriteResource(
      req,
      'resource.binding.update',
      resourceId,
      currentScope.projectId,
      currentScope.environmentId,
      'medium',
    );
    if (
      targetScope.projectId !== currentScope.projectId ||
      targetScope.environmentId !== currentScope.environmentId
    ) {
      await this.assertCanWriteResource(
        req,
        'resource.binding.update',
        resourceId,
        targetScope.projectId,
        targetScope.environmentId,
        'medium',
      );
    }
    return this.resourceControlService.updateResourceBinding(
      req.teamId,
      req.user.id,
      resourceId,
      dto,
    );
  }

  @Post('resources/:resourceId/connection-probe')
  async probeResourceConnection(
    @Request() req: AuthRequest,
    @Param('resourceId') resourceId: string,
    @Body() dto: ProbeResourceConnectionDto,
  ) {
    const scope = await this.resourceControlService.getResourceAccessScope(req.teamId, resourceId);
    await this.assertCanWriteResource(
      req,
      'resource.connection_probe',
      resourceId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'medium' : 'low',
    );
    return this.resourceControlService.probeResourceConnection(
      req.teamId,
      req.user.id,
      resourceId,
      dto,
    );
  }

  @Post('resources/:resourceId/query-runs')
  async runResourceQuery(
    @Request() req: AuthRequest,
    @Param('resourceId') resourceId: string,
    @Body() dto: RunResourceQueryDto,
  ) {
    const scope = await this.resourceControlService.getResourceAccessScope(req.teamId, resourceId);
    await this.assertCanWriteResource(
      req,
      'resource.query',
      resourceId,
      scope.projectId,
      scope.environmentId,
      dto.dryRun === false ? 'medium' : 'low',
    );
    return this.resourceControlService.runResourceQuery(
      req.teamId,
      req.user.id,
      resourceId,
      dto,
    );
  }

  @Post('servers/:serverId/sync-docker')
  async syncServerDocker(
    @Request() req: AuthRequest,
    @Param('serverId') serverId: string,
    @Body() dto: SyncServerDockerDto,
  ) {
    const scope = await this.resourceControlService.resolveEnvironmentAccessScope(req.teamId, dto.environmentId);
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'resource',
      action: 'resource.sync_docker',
      targetType: 'server',
      targetId: serverId,
      risk: 'medium',
    });
    return this.resourceControlService.syncServerDocker(
      req.teamId,
      req.user.id,
      serverId,
      dto,
    );
  }

  @Post('cloud/sync')
  async syncCloudResources(
    @Request() req: AuthRequest,
    @Body() dto: SyncCloudResourcesDto,
  ) {
    const scope = await this.resourceControlService.resolveEnvironmentAccessScope(req.teamId, dto.environmentId);
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'resource',
      action: 'resource.sync_cloud',
      targetType: 'cloud_resources',
      targetId: dto.provider || 'all',
      risk: 'medium',
    });
    return this.resourceControlService.syncCloudResources(
      req.teamId,
      req.user.id,
      dto,
    );
  }

  private assertCanWriteResource(
    req: AuthRequest,
    action: string,
    resourceId: string,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
    subAction?: string,
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource',
      action: subAction ? `${action}.${subAction}` : action,
      targetType: 'managed_resource',
      targetId: resourceId,
      risk,
    });
  }

  private assertCanReadResource(
    req: AuthRequest,
    action: string,
    targetId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    targetType: string = 'managed_resource',
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource',
      action,
      targetType,
      targetId,
      risk: 'low',
    });
  }

  private async filterReadableResourceRecords<T extends ReadableResourceRecord>(
    req: AuthRequest,
    records: T[],
    action: string,
    targetType: string,
  ) {
    const allowed = await Promise.all(records.map(async (record) => {
      const scope = this.getReadableResourceScope(record);
      return {
        record,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: scope.projectId,
          environmentId: scope.environmentId,
          category: 'resource',
          action,
          targetType,
          targetId: record.id,
          risk: 'low',
        }),
      };
    }));

    return allowed.filter((item) => item.allowed).map((item) => item.record);
  }

  private getReadableResourceScope(record: ReadableResourceRecord) {
    const metadataScope = this.getMetadataAccessScope(record.metadata);
    return {
      projectId: record.projectId ?? record.resource?.projectId ?? metadataScope.projectId,
      environmentId: record.environmentId ?? record.resource?.environmentId ?? metadataScope.environmentId,
    };
  }

  private getMetadataAccessScope(metadata: unknown) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { projectId: null, environmentId: null };
    }

    const value = metadata as Record<string, unknown>;
    return {
      projectId: typeof value.projectId === 'string' ? value.projectId : null,
      environmentId: typeof value.environmentId === 'string' ? value.environmentId : null,
    };
  }
}
