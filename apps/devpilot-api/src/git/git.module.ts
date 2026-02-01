import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GitService } from './git.service';
import { GitController } from './git.controller';
import { GithubProvider } from './providers/github.provider';
import { GitlabProvider } from './providers/gitlab.provider';
import { GiteeProvider } from './providers/gitee.provider';

@Module({
  imports: [HttpModule],
  controllers: [GitController],
  providers: [GitService, GithubProvider, GitlabProvider, GiteeProvider],
  exports: [GitService],
})
export class GitModule {}
