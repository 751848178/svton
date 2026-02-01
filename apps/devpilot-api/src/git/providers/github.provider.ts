import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GitProvider, GitUser, GitRepo, CreateRepoOptions } from '../interfaces/git-provider.interface';

@Injectable()
export class GithubProvider implements GitProvider {
  readonly name = 'github';
  private readonly logger = new Logger(GithubProvider.name);
  private readonly baseUrl = 'https://api.github.com';

  constructor(private readonly httpService: HttpService) {}

  private getHeaders(accessToken: string) {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
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
      username: data.login,
      name: data.name || data.login,
      avatar: data.avatar_url,
      email: data.email,
    };
  }

  async listRepos(accessToken: string): Promise<GitRepo[]> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/user/repos`, {
        headers: this.getHeaders(accessToken),
        params: {
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
      cloneUrl: repo.clone_url as string,
      defaultBranch: repo.default_branch as string,
    }));
  }

  async createRepo(accessToken: string, options: CreateRepoOptions): Promise<GitRepo> {
    const { data } = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/user/repos`,
        {
          name: options.name,
          description: options.description,
          private: options.private ?? false,
          auto_init: options.autoInit ?? true,
        },
        { headers: this.getHeaders(accessToken) },
      ),
    );

    return {
      id: String(data.id),
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      private: data.private,
      htmlUrl: data.html_url,
      cloneUrl: data.clone_url,
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

    // 获取当前分支的最新 commit
    let latestSha: string | null = null;
    try {
      const { data: refData } = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/repos/${repo}/git/ref/heads/${branch}`, {
          headers,
        }),
      );
      latestSha = refData.object.sha;
    } catch {
      // 分支不存在，将创建新分支
      this.logger.log(`Branch ${branch} does not exist, will create`);
    }

    // 创建 blobs
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data } = await firstValueFrom(
          this.httpService.post(
            `${this.baseUrl}/repos/${repo}/git/blobs`,
            {
              content: Buffer.from(file.content).toString('base64'),
              encoding: 'base64',
            },
            { headers },
          ),
        );
        return { path: file.path, sha: data.sha, mode: '100644', type: 'blob' };
      }),
    );

    // 创建 tree
    const { data: treeData } = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/repos/${repo}/git/trees`,
        {
          base_tree: latestSha,
          tree: blobs,
        },
        { headers },
      ),
    );

    // 创建 commit
    const { data: commitData } = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/repos/${repo}/git/commits`,
        {
          message,
          tree: treeData.sha,
          parents: latestSha ? [latestSha] : [],
        },
        { headers },
      ),
    );

    // 更新或创建分支引用
    if (latestSha) {
      await firstValueFrom(
        this.httpService.patch(
          `${this.baseUrl}/repos/${repo}/git/refs/heads/${branch}`,
          { sha: commitData.sha },
          { headers },
        ),
      );
    } else {
      await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/repos/${repo}/git/refs`,
          { ref: `refs/heads/${branch}`, sha: commitData.sha },
          { headers },
        ),
      );
    }

    this.logger.log(`Pushed ${files.length} files to ${repo}/${branch}`);
  }
}
