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
  constructor(private readonly resourceRequestService: ResourceRequestService) {}

  @Post()
  create(@Request() req: AuthRequest, @Body() dto: CreateResourceRequestDto) {
    return this.resourceRequestService.createRequest(req.teamId, req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: AuthRequest, @Query() query: ListResourceRequestsQueryDto) {
    return this.resourceRequestService.listRequests(req.teamId, query);
  }

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.resourceRequestService.getRequest(req.teamId, id);
  }

  @Post(':id/review')
  @Roles('team_admin')
  review(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: ReviewResourceRequestDto,
  ) {
    return this.resourceRequestService.reviewRequest(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/complete')
  @Roles('team_admin')
  complete(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CompleteResourceRequestDto,
  ) {
    return this.resourceRequestService.completeRequest(req.teamId, req.user.id, id, dto);
  }

  @Post(':id/cancel')
  cancel(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.resourceRequestService.cancelRequest(req.teamId, req.user.id, id);
  }
}

@Controller('resource-instances')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ResourceInstancesController {
  constructor(private readonly resourceRequestService: ResourceRequestService) {}

  @Get()
  findAll(@Request() req: AuthRequest, @Query() query: ListResourceInstancesQueryDto) {
    return this.resourceRequestService.listInstances(req.teamId, query);
  }

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.resourceRequestService.getInstance(req.teamId, id);
  }

  @Post(':id/release')
  @Roles('team_admin')
  release(@Request() req: AuthRequest, @Param('id') id: string) {
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
