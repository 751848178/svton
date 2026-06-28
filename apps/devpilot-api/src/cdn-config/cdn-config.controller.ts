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
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ControlAccessPolicyService } from '../control-access-policy';
import { CDNConfigService } from './cdn-config.service';
import { CreateCDNConfigDto, UpdateCDNConfigDto, CreateCredentialDto } from './dto/cdn-config.dto';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

type ReadableCdnConfig = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
};

type ReadableTeamCredential = {
  id: string;
};

@Controller('cdn-configs')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class CDNConfigController {
  constructor(
    private readonly cdnConfigService: CDNConfigService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateCDNConfigDto) {
    const scope = await this.cdnConfigService.resolveConfigInputAccessScope(req.teamId, dto);
    await this.assertCanWriteCdn(req, 'cdn_config.create', null, scope.projectId, scope.environmentId, 'medium');
    return this.cdnConfigService.create(req.teamId, req.user.id, dto);
  }

  @Get()
  async findAll(@Request() req: AuthRequest) {
    const configs = await this.cdnConfigService.findAll(req.teamId);
    return this.filterReadableCdnConfigs(req, configs);
  }

  @Get(':id')
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    const config = await this.cdnConfigService.findOne(req.teamId, id);
    await this.assertCanReadCdn(req, 'cdn_config.read', id, config.projectId, config.environmentId);
    return config;
  }

  @Put(':id')
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCDNConfigDto,
  ) {
    const currentScope = await this.cdnConfigService.getConfigAccessScope(req.teamId, id);
    await this.assertCanWriteCdn(req, 'cdn_config.update', id, currentScope.projectId, currentScope.environmentId, 'medium');
    if (dto.projectId !== undefined || dto.environmentId !== undefined) {
      const targetScope = await this.cdnConfigService.resolveConfigInputAccessScope(req.teamId, dto);
      if (
        targetScope.projectId !== currentScope.projectId ||
        targetScope.environmentId !== currentScope.environmentId
      ) {
        await this.assertCanWriteCdn(req, 'cdn_config.update', id, targetScope.projectId, targetScope.environmentId, 'medium');
      }
    }
    return this.cdnConfigService.update(req.teamId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    const scope = await this.cdnConfigService.getConfigAccessScope(req.teamId, id);
    await this.assertCanWriteCdn(req, 'cdn_config.delete', id, scope.projectId, scope.environmentId, 'high');
    return this.cdnConfigService.remove(req.teamId, id);
  }

  @Post(':id/purge')
  async purgeCache(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { paths?: string[] },
  ) {
    const scope = await this.cdnConfigService.getConfigAccessScope(req.teamId, id);
    await this.assertCanWriteCdn(req, 'cdn_config.purge', id, scope.projectId, scope.environmentId, 'medium');
    return this.cdnConfigService.purgeCache(req.teamId, id, body.paths);
  }

  private assertCanWriteCdn(
    req: AuthRequest,
    action: string,
    configId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
    risk: string = 'medium',
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'cdn',
      action,
      targetType: 'cdn_config',
      targetId: configId,
      risk,
    });
  }

  private assertCanReadCdn(
    req: AuthRequest,
    action: string,
    configId: string | null,
    projectId?: string | null,
    environmentId?: string | null,
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId,
      category: 'cdn',
      action,
      targetType: 'cdn_config',
      targetId: configId,
      risk: 'low',
    });
  }

  private async filterReadableCdnConfigs<T extends ReadableCdnConfig>(
    req: AuthRequest,
    configs: T[],
  ) {
    const allowed = await Promise.all(configs.map(async (config) => ({
      config,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        projectId: config.projectId,
        environmentId: config.environmentId,
        category: 'cdn',
        action: 'cdn_config.read',
        targetType: 'cdn_config',
        targetId: config.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.config);
  }
}

@Controller('team-credentials')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class TeamCredentialController {
  constructor(
    private readonly cdnConfigService: CDNConfigService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post()
  async create(@Request() req: AuthRequest, @Body() dto: CreateCredentialDto) {
    await this.assertCanWriteCredential(req, 'team_credential.create', null, 'high');
    return this.cdnConfigService.createCredential(req.teamId, dto);
  }

  @Get()
  async findAll(@Request() req: AuthRequest, @Query('type') type?: string) {
    const credentials = await this.cdnConfigService.findAllCredentials(req.teamId, type);
    return this.filterReadableCredentials(req, credentials);
  }

  @Delete(':id')
  async remove(@Request() req: AuthRequest, @Param('id') id: string) {
    await this.assertCanWriteCredential(req, 'team_credential.delete', id, 'high');
    return this.cdnConfigService.removeCredential(req.teamId, id);
  }

  private assertCanWriteCredential(
    req: AuthRequest,
    action: string,
    credentialId: string | null,
    risk: string,
  ) {
    return this.accessPolicyService.assertCanWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'team_credential',
      action,
      targetType: 'team_credential',
      targetId: credentialId,
      risk,
    });
  }

  private async filterReadableCredentials<T extends ReadableTeamCredential>(
    req: AuthRequest,
    credentials: T[],
  ) {
    const allowed = await Promise.all(credentials.map(async (credential) => ({
      credential,
      allowed: await this.accessPolicyService.canRead({
        teamId: req.teamId,
        actorId: req.user.id,
        category: 'team_credential',
        action: 'team_credential.read',
        targetType: 'team_credential',
        targetId: credential.id,
        risk: 'low',
      }),
    })));

    return allowed.filter((item) => item.allowed).map((item) => item.credential);
  }
}
