import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GitProvider, GitUser, GitRepo, CreateRepoOptions } from '../interfaces/git-provider.interface';

@Injectable()
export class GitlabProvider implements GitProvider {
  readonly name = 'gitlab';
  private readonly logger = new Logger(GitlabProvider.name);
  private readonly baseUrl = 'https://gitlab.com/api/v4';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(accessToken: string) {
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  async getUser(accessToken: string): Promise<GitUser> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/user`, {
        headers: this.getHeaders(accessToken),
      }),
    );

    return {
      id: String(data.id),
      username: data.username,
      name: data.name,
      avatar: data.avatar_url,
      email: data.email,
    };
  }

  async listRepos(accessToken: string): Promise<GitRepo[]> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/projects`, {
        headers: this.getHeaders(accessToken),
        params: {
          membership: true,
          order_by: 'updated_at',
          per_page: 100,
        },
      }),
    );

    return data.map((repo: Record<string, unknown>) => ({
      id: String(repo.id),
      name: repo.name as string,
      fullName: repo.path_with_namespace as string,
      description: (repo.description as string) || '',
      private: (repo.visibility as string) === 'private',
      htmlUrl: repo.web_url as string,
      cloneUrl: repo.http_url_to_repo as string,
      defaultBranch: repo.default_branch as string,
    }));
  }

  async createRepo(accessToken: string, options: CreateRepoOptions): Promise<GitRepo> {
    const { data } = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/projects`,
        {
          name: options.name,
          description: options.description,
          visibility: options.private ? 'private' : 'public',
          initialize_with_readme: options.autoInit ?? true,
        },
        { headers: this.getHeaders(accessToken) },
      ),
    );

    return {
      id: String(data.id),
      name: data.name,
      fullName: data.path_with_namespace,
      description: data.description || '',
      private: data.visibility === 'private',
      htmlUrl: data.web_url,
      cloneUrl: data.http_url_to_repo,
      defaultBranch: data.default_branch,
    };
  }

  async pushFiles(
    accessToken: string,
    repo: string,
    files: { path: string; content: string }[],
    message: string,
    branch = 'main',
  ): Promise<void> {
    const headers = this.getHeaders(accessToken);
    const encodedRepo = encodeURIComponent(repo);

    // GitLab 使用 commits API 批量提交文件
    const actions = files.map((file) => ({
      action: 'create',
      file_path: file.path,
      content: file.content,
    }));

    await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/projects/${encodedRepo}/repository/commits`,
        {
          branch,
          commit_message: message,
          actions,
        },
        { headers },
      ),
    );

    this.logger.log(`Pushed ${files.length} files to ${repo}/${branch}`);
  }
}
