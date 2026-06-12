import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProxyConfigService } from './proxy-config.service';
import { CreateProxyConfigDto, UpdateProxyConfigDto } from './dto/proxy-config.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('proxy-configs')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ProxyConfigController {
  constructor(private readonly proxyConfigService: ProxyConfigService) {}

  @Post()
  @Roles('team_admin')
  create(@Request() req: AuthRequest, @Body() dto: CreateProxyConfigDto) {
    return this.proxyConfigService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.proxyConfigService.findAll(req.teamId);
  }

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.proxyConfigService.findOne(req.teamId, id);
  }

  @Put(':id')
  @Roles('team_admin')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProxyConfigDto,
  ) {
    return this.proxyConfigService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  @Roles('team_admin')
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.proxyConfigService.remove(req.teamId, id);
  }

  @Get(':id/preview')
  preview(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.proxyConfigService.preview(req.teamId, id);
  }

  @Post(':id/sync')
  @Roles('team_admin')
  sync(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.proxyConfigService.sync(req.teamId, id);
  }
}
