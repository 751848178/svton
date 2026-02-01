import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/resource.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamGuard, TeamRoles } from '../team/guards/team.guard';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('resources')
@UseGuards(JwtAuthGuard, TeamGuard)
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  @TeamRoles('owner', 'admin')
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
  @TeamRoles('owner', 'admin')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourceService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  @TeamRoles('owner', 'admin')
  remove(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.resourceService.remove(req.teamId, id);
  }
}
