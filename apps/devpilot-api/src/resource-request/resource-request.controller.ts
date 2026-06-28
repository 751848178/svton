import {
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
  CompleteResourceRequestDto,
  CreateResourceRequestDto,
  CreateResourceTypeDto,
  ListResourceAuditLogsQueryDto,
  ListResourceInstancesQueryDto,
  ListResourceRequestsQueryDto,
  ReviewResourceRequestDto,
  UpdateResourceTypeDto,
} from './dto/resource-request.dto';
import { ResourceRequestService } from './resource-request.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('resource-types')
@UseGuards(JwtAuthGuard)
export class ResourceTypeController {
  constructor(private readonly resourceRequestService: ResourceRequestService) {}

  @Post()
  @UseGuards(AuthzGuard)
  @Roles('admin')
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateResourceTypeDto) {
    return this.resourceRequestService.createResourceType(req.user.id, dto);
  }

  @Get()
  findAll(@Query('includeDisabled') includeDisabled?: string) {
    return this.resourceRequestService.listResourceTypes(includeDisabled === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resourceRequestService.getResourceType(id);
  }

  @Put(':id')
  @UseGuards(AuthzGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateResourceTypeDto) {
    return this.resourceRequestService.updateResourceType(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthzGuard)
  @Roles('admin')
  disable(@Param('id') id: string) {
    return this.resourceRequestService.disableResourceType(id);
  }
}

@Controller('resource-requests')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ResourceRequestsController {
  constructor(
    private readonly resourceRequestService: ResourceRequestService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateResourceRequestDto) {
    const scope = await this.resourceRequestService.resolveRequestInputAccessScope(req.teamId, dto);
    await this.assertCanSelfServiceRequest(
      req,
      'resource_request.create',
      null,
      scope.projectId,
      scope.environmentId,
      'medium',
    );
    return this.resourceRequestService.createRequest(req.teamId, req.user.id, dto);
  }

  @Get()
  async findAll(@Request() req: AuthRequest, @Query() query: ListResourceRequestsQueryDto) {
    const requests = await this.resourceRequestService.listRequests(req.teamId, query);
    const allowed = await Promise.all(
      requests.map(async (request: any) => ({
        request,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: request.projectId,
          environmentId: request.environmentId,
          category: 'resource_request',
          action: 'resource_request.read',
          targetType: 'resource_request',
          targetId: request.id,
          risk: 'low',
        }),
      })),
    );
    return allowed.filter((item) => item.allowed).map((item) => item.request);
  }

  @Get(':id')
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.resourceRequestService.getRequestAccessScope(req.teamId, id);
    await this.assertCanReadRequest(req, 'resource_request.read', id, scope.projectId, scope.environmentId);
    return this.resourceRequestService.getRequest(req.teamId, id);
  }

  @Post(':id/review')
  async review(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ReviewResourceRequestDto,
  ) {
    const scope = await this.resourceRequestService.getRequestAccessScope(req.teamId, id);
    await this.assertCanWriteRequest(req, 'resource_request.review', id, scope.projectId, scope.environmentId, 'medium');
    return this.resourceRequestService.reviewRequest(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/complete')
  async complete(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CompleteResourceRequestDto,
  ) {
    const scope = await this.resourceRequestService.getRequestAccessScope(req.teamId, id);
    await this.assertCanWriteRequest(req, 'resource_request.complete', id, scope.projectId, scope.environmentId, 'high');
    return this.resourceRequestService.completeRequest(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/cancel')
  async cancel(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.resourceRequestService.getRequestAccessScope(req.teamId, id);
    await this.assertCanSelfServiceRequest(req, 'resource_request.cancel', id, scope.projectId, scope.environmentId, 'medium');
    return this.resourceRequestService.cancelRequest(req.teamId, req.user.id, id);
  }

  private assertCanWriteRequest(
    req: AuthRequest,
    action: string,
    requestId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource_request',
      action,
      targetType: 'resource_request',
      targetId: requestId,
      risk,
    });
  }

  private assertCanSelfServiceRequest(
    req: AuthRequest,
    action: string,
    requestId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource_request',
      action,
      targetType: 'resource_request',
      targetId: requestId,
      risk,
    });
  }

  private assertCanReadRequest(
    req: AuthRequest,
    action: string,
    requestId: string,
    projectId?: string | null,
    environmentId?: string | null,
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'resource_request',
      action,
      targetType: 'resource_request',
      targetId: requestId,
      risk: 'low',
    });
  }
}

@Controller('resource-instances')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ResourceInstancesController {
  constructor(
    private readonly resourceRequestService: ResourceRequestService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Get()
  async findAll(@Request() req: AuthRequest, @Query() query: ListResourceInstancesQueryDto) {
    const instances = await this.resourceRequestService.listInstances(req.teamId, query);
    const allowed = await Promise.all(
      instances.map(async (instance: any) => ({
        instance,
        allowed: await this.accessPolicyService.canRead({
          teamId: req.teamId,
          actorId: req.user.id,
          projectId: instance.projectId,
          environmentId: instance.environmentId,
          category: 'resource_instance',
          action: 'resource_instance.read',
          targetType: 'resource_instance',
          targetId: instance.id,
          risk: 'low',
        }),
      })),
    );
    return allowed.filter((item) => item.allowed).map((item) => item.instance);
  }

  @Get(':id')
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.resourceRequestService.getInstanceAccessScope(req.teamId, id);
    await this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'resource_instance',
      action: 'resource_instance.read',
      targetType: 'resource_instance',
      targetId: id,
      risk: 'low',
    });
    return this.resourceRequestService.getInstance(req.teamId, id);
  }

  @Post(':id/release')
  async release(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.resourceRequestService.getInstanceAccessScope(req.teamId, id);
    await this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: scope.projectId,
      environmentId: scope.environmentId,
      category: 'resource_instance',
      action: 'resource_instance.release',
      targetType: 'resource_instance',
      targetId: id,
      risk: 'high',
    });
    return this.resourceRequestService.releaseInstance(req.teamId, req.user.id, id);
  }
}

@Controller('resource-audit-logs')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ResourceAuditLogsController {
  constructor(private readonly resourceRequestService: ResourceRequestService) {}

  @Get()
  findAll(@Request() req: AuthRequest, @Query() query: ListResourceAuditLogsQueryDto) {
    return this.resourceRequestService.listAuditLogs(req.teamId, query);
  }
}
