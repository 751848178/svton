import { Injectable, Logger } from '@nestjs/common';
import { Gitlab } from '@gitbeaker/rest';
import { GitProvider, GitUser, GitRepo, CreateRepoOptions } from '../interfaces/git-provider.interface';

/**
 * GitLab provider，基于 `@gitbeaker/rest`。
 *
 * 取代原裸 `axios` 手搓的 GitLab API 调用。gitbeaker 提供类型安全、
 * 分页与错误归一化。
 */
@Injectable()
export class GitlabProvider implements GitProvider {
  readonly name = 'gitlab';
  private readonly logger = new Logger(GitlabProvider.name);

  private createClient(accessToken: string) {
    return new Gitlab({
      token: accessToken,
    });
  }

  async getUser(accessToken: string): Promise<GitUser> {
    const client = this.createClient(accessToken);
    const user = await client.Users.showCurrentUser();

    return {
      id: String(user.id),
      username: user.username,
      name: user.name,
      avatar: user.avatar_url ?? '',
      email: user.email ?? undefined,
    };
  }

  async listRepos(accessToken: string): Promise<GitRepo[]> {
    const client = this.createClient(accessToken);
    const projects = await client.Projects.all({
      membership: true,
      orderBy: 'updated_at',
      perPage: 100,
    } as never);

    return projects.map((repo) => ({
      id: String(repo.id),
      name: repo.name,
      fullName: repo.path_with_namespace,
      description: repo.description || '',
      private: repo.visibility === 'private',
      htmlUrl: repo.web_url,
      cloneUrl: repo.http_url_to_repo,
      defaultBranch: repo.default_branch ?? 'main',
    }));
  }

  async createRepo(accessToken: string, options: CreateRepoOptions): Promise<GitRepo> {
    const client = this.createClient(accessToken);
    const project = await client.Projects.create({
      name: options.name,
      description: options.description,
      visibility: options.private ? 'private' : 'public',
      initializeWithReadme: options.autoInit ?? true,
    });

    return {
      id: String(project.id),
      name: project.name,
      fullName: project.path_with_namespace,
      description: project.description || '',
      private: project.visibility === 'private',
      htmlUrl: project.web_url,
      cloneUrl: project.http_url_to_repo,
      defaultBranch: project.default_branch ?? 'main',
    };
  }

  async pushFiles(
    accessToken: string,
    repo: string,
    files: { path: string; content: string }[],
    message: string,
    branch = 'main',
  ): Promise<void> {
    const client = this.createClient(accessToken);
    // GitLab commits API 支持批量 actions，一条调用即可提交多文件。
    await client.Commits.create(repo, branch, message, files.map((file) => ({
      action: 'create' as const,
      filePath: file.path,
      content: file.content,
    })));

    this.logger.log(`Pushed ${files.length} files to ${repo}/${branch}`);
  }
}
