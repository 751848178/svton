import { Injectable, Logger } from '@nestjs/common';
import type { Octokit } from '@octokit/rest';
import { GitProvider, GitUser, GitRepo, CreateRepoOptions } from '../interfaces/git-provider.interface';

/**
 * GitHub provider，基于 `@octokit/rest`。
 *
 * octokit 22.x 是 ESM-only，与本项目 CommonJS/jest 静态 import 冲突。
 * 用**动态 import()** 解决：运行时加载 octokit（jest 不在静态分析阶段触发 ESM 转换），
 * 加载后缓存到 `octokitModule`，后续调用无重复加载开销。
 *
 * 取代原裸 axios 手搓的 Git Database flow（getRef → createBlob → createTree →
 * createCommit → updateRef）。octokit 提供类型安全、分页、限流与错误归一化。
 */
@Injectable()
export class GithubProvider implements GitProvider {
  readonly name = 'github';
  private readonly logger = new Logger(GithubProvider.name);
  private octokitModulePromise: Promise<typeof import('@octokit/rest')> | undefined;

  /** 动态加载 octokit 模块（仅首次调用时加载，后续复用缓存）。 */
  private async getOctokitModule(): Promise<typeof import('@octokit/rest')> {
    if (!this.octokitModulePromise) {
      // 动态 import 避开 CJS/ESM 静态解析冲突（jest 不会在静态分析阶段转换它）
      this.octokitModulePromise = import('@octokit/rest');
    }
    return this.octokitModulePromise;
  }

  private async createClient(accessToken: string): Promise<Octokit> {
    const { Octokit } = await this.getOctokitModule();
    return new Octokit({
      auth: accessToken,
      baseUrl: 'https://api.github.com',
      request: { retries: 0 },
    });
  }

  async getUser(accessToken: string): Promise<GitUser> {
    const octokit = await this.createClient(accessToken);
    const { data } = await octokit.rest.users.getAuthenticated();
    return {
      id: String(data.id),
      username: data.login,
      name: data.name || data.login,
      avatar: data.avatar_url,
      email: data.email ?? undefined,
    };
  }

  async listRepos(accessToken: string): Promise<GitRepo[]> {
    const octokit = await this.createClient(accessToken);
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });
    return data.map((repo) => ({
      id: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || '',
      private: repo.private,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
    }));
  }

  async createRepo(accessToken: string, options: CreateRepoOptions): Promise<GitRepo> {
    const octokit = await this.createClient(accessToken);
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private ?? false,
      auto_init: options.autoInit ?? true,
    });
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
    const octokit = await this.createClient(accessToken);
    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      throw new Error(`invalid github repo identifier: ${repo}; expected owner/name`);
    }

    let latestSha: string | null = null;
    try {
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo: name,
        ref: `heads/${branch}`,
      });
      latestSha = refData.object.sha;
    } catch {
      this.logger.log(`Branch ${branch} does not exist, will create`);
    }

    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data } = await octokit.rest.git.createBlob({
          owner,
          repo: name,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });
        return { path: file.path, sha: data.sha, mode: '100644' as const, type: 'blob' as const };
      }),
    );

    const { data: treeData } = await octokit.rest.git.createTree({
      owner,
      repo: name,
      base_tree: latestSha ?? undefined,
      tree: blobs,
    });

    const { data: commitData } = await octokit.rest.git.createCommit({
      owner,
      repo: name,
      message,
      tree: treeData.sha,
      parents: latestSha ? [latestSha] : [],
    });

    if (latestSha) {
      await octokit.rest.git.updateRef({
        owner,
        repo: name,
        ref: `heads/${branch}`,
        sha: commitData.sha,
      });
    } else {
      await octokit.rest.git.createRef({
        owner,
        repo: name,
        ref: `refs/heads/${branch}`,
        sha: commitData.sha,
      });
    }

    this.logger.log(`Pushed ${files.length} files to ${repo}/${branch}`);
  }
}
