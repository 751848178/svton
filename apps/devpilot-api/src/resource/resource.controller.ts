import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';
import { ResourceService } from './resource.service';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableResourceCredential = {
  id: string;
};

@Controller('resources')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ResourceController {
  constructor(
    private readonly resourceService: ResourceService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post()
  async create(
    @Request() req: AuthRequest,
    @Body() dto: CreateResourceDto,
  ) {
    await this.assertCanWriteResourceCredential(req, 'resource_credential.create', null, 'high');
    return this.resourceService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  async findAll(
    @Request() req: AuthRequest,
    @Query('type') type?: string,
  ) {
    const resources = type
      ? await this.resourceService.findByType(req.teamId, type)
      : await this.resourceService.findAll(req.teamId);
    return this.filterReadableResourceCredentials(req, resources);
  }

  @Get(':id')
  async findOne(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    const resource = await this.resourceService.findOne(req.teamId, id);
    await this.assertCanReadResourceCredential(req, 'resource_credential.read', id);
    return resource;
  }

  @Put(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    await this.assertCanWriteResourceCredential(req, 'resource_credential.update', id, 'high');
    return this.resourceService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    await this.assertCanWriteResourceCredential(req, 'resource_credential.delete', id, 'high');
    return this.resourceService.remove(req.teamId, id);
  }

  private assertCanWriteResourceCredential(
    req: AuthRequest,
    action: string,
    resourceId: string | null,
    risk: string,
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'resource_credential',
      action,
      targetType: 'resource',
      targetId: resourceId,
      risk,
    });
  }

  private assertCanReadResourceCredential(
    req: AuthRequest,
    action: string,
    resourceId: string | null,
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'resource_credential',
      action,
      targetType: 'resource',
      targetId: resourceId,
      risk: 'low',
    });
  }

  private async filterReadableResourceCredentials<T extends ReadableResourceCredential>(
    req: AuthRequest,
    resources: T[],
  ) {
    const allowed = await Promise.all(resources.map(async (resource) => ({
      resource,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        category: 'resource_credential',
        action: 'resource_credential.read',
        targetType: 'resource',
        targetId: resource.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.resource);
  }
}
