import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthzGuard, Roles } from '@svton/nestjs-authz';
import { ControlAccessPolicyService } from '../control-access-policy';
import { GitService } from './git.service';
import { ConnectGitDto, CreateRepoDto, PushFilesDto } from './dto/git.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthRequest {
  user: { id: string };
  teamId: string;
}

@Controller('git')
@UseGuards(JwtAuthGuard, AuthzGuard)
@Roles('team_member')
export class GitController {
  constructor(
    private readonly gitService: GitService,
    private readonly accessPolicyService: ControlAccessPolicyService,
  ) {}

  @Post('connect')
  async connect(
    @Request() req: AuthRequest,
    @Body() dto: ConnectGitDto,
  ) {
    await this.assertCanWriteGit(req, 'git.connect', dto.provider, 'high');
    return this.gitService.saveConnection(
      req.user.id,
      dto.provider,
      dto.accessToken,
      dto.refreshToken,
    );
  }

  @Get('connections')
  async getConnections(@Request() req: AuthRequest) {
    await this.assertCanReadGit(req, 'git.connections.read', null, 'low');
    return this.gitService.getConnections(req.user.id);
  }

  @Delete('connections/:provider')
  async removeConnection(
    @Request() req: AuthRequest,
    @Param('provider') provider: 'github' | 'gitlab' | 'gitee',
  ) {
    await this.assertCanWriteGit(req, 'git.connection.delete', provider, 'high');
    return this.gitService.removeConnection(req.user.id, provider);
  }

  @Get('repos')
  async listRepos(
    @Request() req: AuthRequest,
    @Query('provider') provider: 'github' | 'gitlab' | 'gitee',
  ) {
    await this.assertCanReadGit(req, 'git.repos.list', provider, 'medium');
    return this.gitService.listRepos(req.user.id, provider);
  }

  @Post('repos')
  async createRepo(
    @Request() req: AuthRequest,
    @Body() dto: CreateRepoDto,
  ) {
    await this.assertCanWriteGit(req, 'git.repo.create', dto.provider, 'high');
    return this.gitService.createRepo(req.user.id, dto.provider, {
      name: dto.name,
      description: dto.description,
      private: dto.private,
    });
  }

  @Post('push')
  async pushFiles(
    @Request() req: AuthRequest,
    @Body() dto: PushFilesDto,
  ) {
    await this.assertCanWriteGit(req, 'git.repo.push', dto.provider, 'high');
    return this.gitService.pushToRepo(
      req.user.id,
      dto.provider,
      dto.repo,
      dto.files,
      dto.message,
    );
  }

  private assertCanReadGit(
    req: AuthRequest,
    action: string,
    targetId: string | null,
    risk: 'low' | 'medium',
  ) {
    return this.accessPolicyService.assertCanRead({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'git',
      action,
      targetType: 'git_connection',
      targetId,
      risk,
    });
  }

  private assertCanWriteGit(
    req: AuthRequest,
    action: string,
    targetId: string | null,
    risk: 'high',
  ) {
    return this.accessPolicyService.assertCanSelfServiceWrite({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'git',
      action,
      targetType: 'git_connection',
      targetId,
      risk,
    });
  }
}
