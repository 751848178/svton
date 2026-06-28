import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  ApplyProjectEnvironmentSyncSuggestionsDto,
  BindProjectEnvironmentServerDto,
  BulkBindProjectEnvironmentResourcesDto,
  CopyProjectEnvironmentCdnConfigsDto,
  CopyProjectEnvironmentResourcesDto,
  CopyProjectEnvironmentSitesDto,
  CreateProjectEnvironmentDto,
  ListProjectEnvironmentSyncSuggestionsQueryDto,
  ListProjectEnvironmentsQueryDto,
  SyncProjectEnvironmentsDto,
  UpdateProjectEnvironmentDto,
} from './dto/project-environment.dto';
import { ProjectEnvironmentService } from './project-environment.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableProjectEnvironmentRecord = {
  id: string;
  projectId: string;
};

@Controller('project-environments')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ProjectEnvironmentController {
  constructor(
    private readonly environmentService: ProjectEnvironmentService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async list(
    @Request() req: AuthRequest,
    @Query() query: ListProjectEnvironmentsQueryDto,
  ) {
    const environments = await this.environmentService.list(req.teamId, query);
    return this.filterReadableEnvironments(req, environments);
  }

  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateProjectEnvironmentDto) {
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: dto.projectId,
      category: 'project_environment',
      action: 'project_environment.create',
      targetType: 'project_environment',
      risk: 'medium',
    });
    return this.environmentService.create(req.teamId, dto);
  }

  @Get('sync-suggestions')
  async listSyncSuggestions(
    @Request() req: AuthRequest,
    @Query() query: ListProjectEnvironmentSyncSuggestionsQueryDto,
  ) {
    if (!query.projectId) {
      throw new BadRequestException('projectId 不能为空');
    }

    const environments = await this.environmentService.list(req.teamId, {
      projectId: query.projectId,
      status: 'active',
    });
    const readableEnvironments = await this.filterReadableEnvironments(req, environments);

    return this.environmentService.listSyncSuggestions(
      req.teamId,
      query,
      readableEnvironments.map((environment) => environment.id),
    );
  }

  @Post('sync-suggestions/apply')
  async applySyncSuggestions(
    @Request() req: AuthRequest,
    @Body() dto: ApplyProjectEnvironmentSyncSuggestionsDto,
  ) {
    const scope = await this.environmentService.getSyncApplyAccessScope(req.teamId, dto);
    await this.assertCanReadEnvironment(
      req,
      scope.sourceEnvironmentId,
      scope.projectId,
      scope.sourceEnvironmentId,
    );
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.targetEnvironmentId,
      category: 'project_environment',
      action: 'project_environment.sync_suggestions.apply',
      targetType: 'project_environment',
      targetId: scope.targetEnvironmentId,
      risk: dto.dryRun === false ? 'medium' : 'low',
    });

    return this.environmentService.applySyncSuggestions(req.teamId, req.user.id, dto);
  }

  @Post('resources/bulk-bind')
  async bulkBindResources(
    @Request() req: AuthRequest,
    @Body() dto: BulkBindProjectEnvironmentResourcesDto,
  ) {
    const scope = await this.environmentService.getResourceBulkBindingAccessScope(req.teamId, dto);
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'project_environment',
      action: 'project_environment.resources.bulk_bind',
      targetType: 'project_environment',
      targetId: scope.environmentId,
      risk: dto.dryRun === false ? 'medium' : 'low',
    });

    return this.environmentService.bulkBindResources(req.teamId, req.user.id, dto);
  }

  @Post('sites/copy')
  async copySites(
    @Request() req: AuthRequest,
    @Body() dto: CopyProjectEnvironmentSitesDto,
  ) {
    const scope = await this.environmentService.getSiteCopyAccessScope(req.teamId, dto);
    await this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.sourceEnvironmentId,
      category: 'project_environment',
      action: 'project_environment.sites.copy.read_source',
      targetType: 'project_environment',
      targetId: scope.sourceEnvironmentId,
      risk: 'low',
    });
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.targetEnvironmentId,
      category: 'project_environment',
      action: 'project_environment.sites.copy',
      targetType: 'project_environment',
      targetId: scope.targetEnvironmentId,
      risk: dto.dryRun === false ? 'medium' : 'low',
    });

    return this.environmentService.copySites(req.teamId, req.user.id, dto);
  }

  @Post('cdn-configs/copy')
  async copyCdnConfigs(
    @Request() req: AuthRequest,
    @Body() dto: CopyProjectEnvironmentCdnConfigsDto,
  ) {
    const scope = await this.environmentService.getCdnConfigCopyAccessScope(req.teamId, dto);
    await this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.sourceEnvironmentId,
      category: 'project_environment',
      action: 'project_environment.cdn_configs.copy.read_source',
      targetType: 'project_environment',
      targetId: scope.sourceEnvironmentId,
      risk: 'low',
    });
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.targetEnvironmentId,
      category: 'project_environment',
      action: 'project_environment.cdn_configs.copy',
      targetType: 'project_environment',
      targetId: scope.targetEnvironmentId,
      risk: dto.dryRun === false ? 'medium' : 'low',
    });

    return this.environmentService.copyCdnConfigs(req.teamId, req.user.id, dto);
  }

  @Post('resources/copy')
  async copyResources(
    @Request() req: AuthRequest,
    @Body() dto: CopyProjectEnvironmentResourcesDto,
  ) {
    const scope = await this.environmentService.getResourceCopyAccessScope(req.teamId, dto);
    await this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.sourceEnvironmentId,
      category: 'project_environment',
      action: 'project_environment.resources.copy.read_source',
      targetType: 'project_environment',
      targetId: scope.sourceEnvironmentId,
      risk: 'low',
    });
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.targetEnvironmentId,
      category: 'project_environment',
      action: 'project_environment.resources.copy',
      targetType: 'project_environment',
      targetId: scope.targetEnvironmentId,
      risk: dto.dryRun === false ? 'medium' : 'low',
    });

    return this.environmentService.copyResources(req.teamId, req.user.id, dto);
  }

  @Put(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProjectEnvironmentDto,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'project_environment',
      action: 'project_environment.update',
      targetType: 'project_environment',
      targetId: id,
      risk: 'medium',
    });
    return this.environmentService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  async archive(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'project_environment',
      action: 'project_environment.archive',
      targetType: 'project_environment',
      targetId: id,
      risk: 'high',
    });
    return this.environmentService.archive(req.teamId, id);
  }

  @Get(':id/servers')
  async listServers(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.assertCanReadEnvironment(req, id, scope.projectId, scope.environmentId);
    return this.environmentService.listServers(req.teamId, id);
  }

  @Post(':id/servers')
  async bindServer(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: BindProjectEnvironmentServerDto,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'project_environment',
      action: 'project_environment.server.bind',
      targetType: 'project_environment_server',
      targetId: dto.serverId,
      risk: 'medium',
    });
    return this.environmentService.bindServer(req.teamId, req.user.id, id, dto);
  }

  @Delete(':id/servers/:serverId')
  async unbindServer(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Param('serverId') serverId: string,
  ) {
    const scope = await this.environmentService.getAccessScope(req.teamId, id);
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'project_environment',
      action: 'project_environment.server.unbind',
      targetType: 'project_environment_server',
      targetId: serverId,
      risk: 'medium',
    });
    return this.environmentService.unbindServer(req.teamId, req.user.id, id, serverId);
  }

  @Post('sync-from-project')
  async syncFromProject(
    @Request() req: AuthRequest,
    @Body() dto: SyncProjectEnvironmentsDto,
  ) {
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: dto.projectId,
      category: 'project_environment',
      action: 'project_environment.sync_from_project',
      targetType: 'project',
      targetId: dto.projectId,
      risk: 'medium',
    });
    return this.environmentService.syncFromProject(req.teamId, dto.projectId);
  }

  private assertCanReadEnvironment(
    req: AuthRequest,
    environmentId: string,
    projectId: string,
    scopedEnvironmentId: string,
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId: scopedEnvironmentId,
      category: 'project_environment',
      action: 'project_environment.read',
      targetType: 'project_environment',
      targetId: environmentId,
      risk: 'low',
    });
  }

  private async filterReadableEnvironments<T extends ReadableProjectEnvironmentRecord>(
    req: AuthRequest,
    environments: T[],
  ) {
    const allowed = await Promise.all(environments.map(async (environment) => ({
      environment,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: environment.projectId,
        environmentId: environment.id,
        category: 'project_environment',
        action: 'project_environment.read',
        targetType: 'project_environment',
        targetId: environment.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.environment);
  }
}
