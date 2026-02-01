import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamGuard, TeamRoles } from '../team/guards/team.guard';
import { CDNConfigService } from './cdn-config.service';
import { CreateCDNConfigDto, UpdateCDNConfigDto, CreateCredentialDto } from './dto/cdn-config.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('cdn-configs')
@UseGuards(JwtAuthGuard, TeamGuard)
export class CDNConfigController {
  constructor(private readonly cdnConfigService: CDNConfigService) {}

  @Post()
  @TeamRoles('owner', 'admin')
  create(@Request() req: AuthRequest, @Body() dto: CreateCDNConfigDto) {
    return this.cdnConfigService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.cdnConfigService.findAll(req.teamId);
  }

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.cdnConfigService.findOne(req.teamId, id);
  }

  @Put(':id')
  @TeamRoles('owner', 'admin')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCDNConfigDto,
  ) {
    return this.cdnConfigService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  @TeamRoles('owner', 'admin')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.cdnConfigService.remove(req.teamId, id);
  }

  @Post(':id/purge')
  @TeamRoles('owner', 'admin')
  purgeCache(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { paths?: string[] },
  ) {
    return this.cdnConfigService.purgeCache(req.teamId, id, body.paths);
  }
}

@Controller('team-credentials')
@UseGuards(JwtAuthGuard, TeamGuard)
export class TeamCredentialController {
  constructor(private readonly cdnConfigService: CDNConfigService) {}

  @Post()
  @TeamRoles('owner', 'admin')
  create(@Request() req: AuthRequest, @Body() dto: CreateCredentialDto) {
    return this.cdnConfigService.createCredential(req.teamId, dto);
  }

  @Get()
  findAll(@Request() req: AuthRequest, @Query('type') type?: string) {
    return this.cdnConfigService.findAllCredentials(req.teamId, type);
  }

  @Delete(':id')
  @TeamRoles('owner', 'admin')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.cdnConfigService.removeCredential(req.teamId, id);
  }
}
