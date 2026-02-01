import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { GitService } from './git.service';
import { ConnectGitDto, CreateRepoDto, PushFilesDto } from './dto/git.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('git')
@UseGuards(JwtAuthGuard)
export class GitController {
  constructor(private readonly gitService: GitService) {}

  @Post('connect')
  connect(
    @Request() req: { user: { id: string } },
    @Body() dto: ConnectGitDto,
  ) {
    return this.gitService.saveConnection(
      req.user.id,
      dto.provider,
      dto.accessToken,
      dto.refreshToken,
    );
  }

  @Get('connections')
  getConnections(@Request() req: { user: { id: string } }) {
    return this.gitService.getConnections(req.user.id);
  }

  @Delete('connections/:provider')
  removeConnection(
    @Request() req: { user: { id: string } },
    @Param('provider') provider: 'github' | 'gitlab' | 'gitee',
  ) {
    return this.gitService.removeConnection(req.user.id, provider);
  }

  @Get('repos')
  listRepos(
    @Request() req: { user: { id: string } },
    @Query('provider') provider: 'github' | 'gitlab' | 'gitee',
  ) {
    return this.gitService.listRepos(req.user.id, provider);
  }

  @Post('repos')
  createRepo(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateRepoDto,
  ) {
    return this.gitService.createRepo(req.user.id, dto.provider, {
      name: dto.name,
      description: dto.description,
      private: dto.private,
    });
  }

  @Post('push')
  pushFiles(
    @Request() req: { user: { id: string } },
    @Body() dto: PushFilesDto,
  ) {
    return this.gitService.pushToRepo(
      req.user.id,
      dto.provider,
      dto.repo,
      dto.files,
      dto.message,
    );
  }
}
