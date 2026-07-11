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
  ForbiddenException,
} from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { ServerService } from './server.service';
import { CreateServerDto, UpdateServerDto } from './dto/server.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ServerEnvironmentBinding = {
  projectId?: string | null;
  environmentId?: string | null;
};

type ReadableServerRecord = {
  id: string;
  environmentBindings?: ServerEnvironmentBinding[];
};

@Controller('servers')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class ServerController {
  constructor(
    private readonly serverService: ServerService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateServerDto) {
    await this.assertCanWriteServer(req, 'server.create', null, 'medium');
    return this.serverService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  async findAll(@Request() req: AuthRequest) {
    const servers = await this.serverService.findAll(req.teamId);
    return this.filterReadableServers(req, servers);
  }

  @Get(':id')
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    const server = await this.serverService.findOne(req.teamId, id);
    await this.assertCanReadServer(req, server);
    return server;
  }

  @Put(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateServerDto,
  ) {
    await this.assertCanWriteServer(req, 'server.update', id, 'medium');
    return this.serverService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    await this.assertCanWriteServer(req, 'server.delete', id, 'high');
    return this.serverService.remove(req.teamId, id);
  }

  @Post(':id/test')
  async testConnection(@Request() req: AuthRequest, @Param('id') id: string) {
    await this.assertCanSelfServiceWriteServer(req, 'server.connection_test', id, 'low');
    return this.serverService.testConnection(req.teamId, id);
  }

  @Post(':id/detect')
  async detectServices(@Request() req: AuthRequest, @Param('id') id: string) {
    await this.assertCanWriteServer(req, 'server.detect_services', id, 'medium');
    return this.serverService.detectServices(req.teamId, id);
  }

  private async assertCanWriteServer(
    req: AuthRequest,
    action: string,
    serverId: string | null,
    risk: string,
  ) {
    const scopes = await this.getWritableServerScopes(req, serverId);
    for (const scope of scopes) {
      await this.accessPolicyService.assertCanWrite({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: scope.projectId ?? null,
        environmentId: scope.environmentId ?? null,
        category: 'server',
        action,
        targetType: 'server',
        targetId: serverId,
        risk,
      });
    }
  }

  private async assertCanSelfServiceWriteServer(
    req: AuthRequest,
    action: string,
    serverId: string,
    risk: string,
  ) {
    const scopes = await this.getWritableServerScopes(req, serverId);
    for (const scope of scopes) {
      await this.accessPolicyService.assertCanSelfServiceWrite({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: scope.projectId ?? null,
        environmentId: scope.environmentId ?? null,
        category: 'server',
        action,
        targetType: 'server',
        targetId: serverId,
        risk,
      });
    }
  }

  private async getWritableServerScopes(req: AuthRequest, serverId: string | null) {
    if (!serverId) return [{ projectId: null, environmentId: null }];
    const server = await this.serverService.findOne(req.teamId, serverId);
    return this.getServerAccessScopes(server);
  }

  private async filterReadableServers<T extends ReadableServerRecord>(
    req: AuthRequest,
    servers: T[],
  ) {
    const allowed = await Promise.all(servers.map(async (server) => ({
      server,
      allowed: await this.canReadServer(req, server),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.server);
  }

  private async assertCanReadServer(req: AuthRequest, server: ReadableServerRecord) {
    if (await this.canReadServer(req, server)) return;
    throw new ForbiddenException('缺少服务器读取权限');
  }

  private async canReadServer(req: AuthRequest, server: ReadableServerRecord) {
    const scopes = this.getServerAccessScopes(server);
    for (const scope of scopes) {
      const allowed = await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: scope.projectId ?? null,
        environmentId: scope.environmentId ?? null,
        category: 'server',
        action: 'server.read',
        targetType: 'server',
        targetId: server.id,
        risk: 'low',
      });
      if (allowed) return true;
    }
    return false;
  }

  private getServerAccessScopes(server: ReadableServerRecord) {
    if (!server.environmentBindings || server.environmentBindings.length === 0) {
      return [{ projectId: null, environmentId: null }];
    }

    const seen = new Set<string>();
    return server.environmentBindings.filter((binding) => {
      const key = `${binding.projectId || ''}:${binding.environmentId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
