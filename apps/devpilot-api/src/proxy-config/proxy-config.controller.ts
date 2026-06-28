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
import { ControlAccessPolicyService } from '../control-access-policy';
import { ProxyConfigService } from './proxy-config.service';
import { CreateProxyConfigDto, UpdateProxyConfigDto } from './dto/proxy-config.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableProxyConfig = {
  id: string;
  projectId?: string | null;
};

@Controller('proxy-configs')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ProxyConfigController {
  constructor(
    private readonly proxyConfigService: ProxyConfigService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post()
  @Roles('team_admin')
  async create(@Request() req: AuthRequest, @Body() dto: CreateProxyConfigDto) {
    const scope = await this.proxyConfigService.resolveConfigInputAccessScope(req.teamId, dto);
    await this.assertCanWriteProxyConfig(req, 'proxy_config.create', null, scope.projectId, 'medium');
    return this.proxyConfigService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  async findAll(@Request() req: AuthRequest) {
    const configs = await this.proxyConfigService.findAll(req.teamId);
    return this.filterReadableProxyConfigs(req, configs);
  }

  @Get(':id')
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    const config = await this.proxyConfigService.findOne(req.teamId, id);
    await this.assertCanReadProxyConfig(req, id, config.projectId);
    return config;
  }

  @Put(':id')
  @Roles('team_admin')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProxyConfigDto,
  ) {
    const currentScope = await this.proxyConfigService.getConfigAccessScope(req.teamId, id);
    await this.assertCanWriteProxyConfig(req, 'proxy_config.update', id, currentScope.projectId, 'medium');
    if (dto.projectId !== undefined) {
      const targetScope = await this.proxyConfigService.resolveConfigInputAccessScope(req.teamId, dto);
      if (targetScope.projectId !== currentScope.projectId) {
        await this.assertCanWriteProxyConfig(req, 'proxy_config.update', id, targetScope.projectId, 'medium');
      }
    }
    return this.proxyConfigService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  @Roles('team_admin')
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.proxyConfigService.getConfigAccessScope(req.teamId, id);
    await this.assertCanWriteProxyConfig(req, 'proxy_config.delete', id, scope.projectId, 'high');
    return this.proxyConfigService.remove(req.teamId, id);
  }

  @Get(':id/preview')
  async preview(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.proxyConfigService.getConfigAccessScope(req.teamId, id);
    await this.assertCanReadProxyConfig(req, id, scope.projectId);
    return this.proxyConfigService.preview(req.teamId, id);
  }

  @Post(':id/sync')
  @Roles('team_admin')
  async sync(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.proxyConfigService.getConfigAccessScope(req.teamId, id);
    await this.assertCanWriteProxyConfig(req, 'proxy_config.sync', id, scope.projectId, 'high');
    return this.proxyConfigService.sync(req.teamId, id);
  }

  private assertCanWriteProxyConfig(
    req: AuthRequest,
    action: string,
    configId: string | null,
    projectId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      category: 'site',
      action,
      targetType: 'proxy_config',
      targetId: configId,
      risk,
    });
  }

  private assertCanReadProxyConfig(
    req: AuthRequest,
    configId: string,
    projectId?: string | null,
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      category: 'site',
      action: 'proxy_config.read',
      targetType: 'proxy_config',
      targetId: configId,
      risk: 'low',
    });
  }

  private async filterReadableProxyConfigs<T extends ReadableProxyConfig>(
    req: AuthRequest,
    configs: T[],
  ) {
    const allowed = await Promise.all(configs.map(async (config) => ({
      config,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: config.projectId,
        category: 'site',
        action: 'proxy_config.read',
        targetType: 'proxy_config',
        targetId: config.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.config);
  }
}
