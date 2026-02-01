import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GitProvider, GitUser, GitRepo, CreateRepoOptions } from '../interfaces/git-provider.interface';

@Injectable()
export class GiteeProvider implements GitProvider {
  readonly name = 'gitee';
  private readonly logger = new Logger(GiteeProvider.name);
  private readonly baseUrl = 'https://gitee.com/api/v5';

  constructor(private readonly httpService: HttpService) {}

  async getUser(accessToken: string): Promise<GitUser> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/user`, {
        params: { access_token: accessToken },
      }),
    );

    return {
      id: String(data.id),
      username: data.login,
      name: data.name || data.login,
      avatar: data.avatar_url,
      email: data.email,
    };
  }

  async listRepos(accessToken: string): Promise<GitRepo[]> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/user/repos`, {
        params: {
          access_token: accessToken,
          sort: 'updated',
          per_page: 100,
        },
      }),
    );

    return data.map((repo: Record<string, unknown>) => ({
      id: String(repo.id),
      name: repo.name as string,
      fullName: repo.full_name as string,
      description: (repo.description as string) || '',
      private: repo.private as boolean,
      htmlUrl: repo.html_url as string,
      cloneUrl: repo.html_url + '.git',
      defaultBranch: (repo.default_branch as string) || 'master',
    }));
  }

  async createRepo(accessToken: string, options: CreateRepoOptions): Promise<GitRepo> {
    const { data } = await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/user/repos`, null, {
        params: {
          access_token: accessToken,
          name: options.name,
          description: options.description,
          private: options.private ?? false,
          auto_init: options.autoInit ?? true,
        },
      }),
    );

    return {
      id: String(data.id),
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      private: data.private,
      htmlUrl: data.html_url,
      cloneUrl: data.html_url + '.git',
      defaultBranch: data.default_branch || 'master',
    };
  }

  async pushFiles(
    accessToken: string,
    repo: string,
    files: { path: string; content: string }[],
    message: string,
    branch = 'master',
  ): Promise<void> {
    // Gitee 需要逐个文件提交
    for (const file of files) {
      await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/repos/${repo}/contents/${file.path}`,
          null,
          {
            params: {
              access_token: accessToken,
              content: Buffer.from(file.content).toString('base64'),
              message,
              branch,
            },
          },
        ),
      );
    }

    this.logger.log(`Pushed ${files.length} files to ${repo}/${branch}`);
  }
}
