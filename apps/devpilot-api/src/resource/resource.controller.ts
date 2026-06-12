import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { ResourceService } from './resource.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('resources')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  @Roles('team_admin')
  create(
    @Request() req: AuthRequest,
    @Body() dto: CreateResourceDto,
  ) {
    return this.resourceService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  findAll(
    @Request() req: AuthRequest,
    @Query('type') type?: string,
  ) {
    if (type) {
      return this.resourceService.findByType(req.teamId, type);
    }
    return this.resourceService.findAll(req.teamId);
  }

  @Get(':id')
  findOne(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.resourceService.findOne(req.teamId, id);
  }

  @Put(':id')
  @Roles('team_admin')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourceService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  @Roles('team_admin')
  remove(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.resourceService.remove(req.teamId, id);
  }
}
