import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { realpathSync } from 'fs';
import { mkdtemp, realpath, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { delimiter, relative, resolve } from 'path';
import {
  REPOSITORY_ANALYSIS_DEFAULTS,
} from './repository-analysis.constants';
import { RepositoryGitError } from './repository-git-error.utils';
import { RepositoryGitCommandService } from './repository-git-command.service';
import {
  RepositoryCheckout,
  RepositoryCredentialMaterial,
  ResolvedRepositoryRef,
} from './repository-analysis.types';
import { validateRepositoryBranch } from './repository-analysis-validation.utils';

@Injectable()
export class RepositoryGitExecutorService {
  private readonly localRoots: string[];

  constructor(
    config: ConfigService,
    private readonly command: RepositoryGitCommandService,
  ) {
    this.localRoots = (config.get<string>('REPOSITORY_ANALYSIS_LOCAL_ROOTS') || '')
      .split(delimiter)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(canonicalAllowedRoot);
  }

  async assertRepositorySourceAllowed(repositoryUrl: string): Promise<void> {
    const localPath = this.localPath(repositoryUrl);
    if (!localPath) return;
    const actual = await realpath(localPath);
    const allowed = this.localRoots.some((root) => {
      const child = relative(root, actual);
      return child === '' || (!child.startsWith('..') && !child.startsWith('/'));
    });
    if (!allowed) {
      throw new RepositoryGitError({
        code: 'REPOSITORY_LOCAL_PATH_DISABLED',
        message: '本地仓库不在允许的只读范围内',
        action: '请使用远程仓库地址，或由管理员加入允许的本地仓库根目录。',
      });
    }
  }

  allowsLocal(repositoryUrl: string): boolean {
    return !this.localPath(repositoryUrl) || this.localRoots.length > 0;
  }

  async resolveRef(
    repositoryUrl: string,
    requestedBranch: string | undefined,
    credential: RepositoryCredentialMaterial,
  ): Promise<ResolvedRepositoryRef> {
    await this.assertRepositorySourceAllowed(repositoryUrl);
    const [headOutput, headsOutput] = await Promise.all([
      this.runGit(['ls-remote', '--symref', '--', repositoryUrl, 'HEAD'], credential),
      this.runGit(['ls-remote', '--heads', '--', repositoryUrl], credential),
    ]);
    const branches = headsOutput.stdout
      .split('\n')
      .map((line) => line.match(/^[a-f0-9]{40,64}\s+refs\/heads\/(.+)$/i)?.[1])
      .filter((item): item is string => Boolean(item))
      .sort()
      .slice(0, REPOSITORY_ANALYSIS_DEFAULTS.maxBranches);
    const defaultBranch = headOutput.stdout
      .match(/^ref:\s+refs\/heads\/(.+)\s+HEAD$/m)?.[1];
    if (!defaultBranch) {
      throw new RepositoryGitError({
        code: 'REPOSITORY_DEFAULT_BRANCH_UNKNOWN',
        message: '仓库未返回默认分支',
        action: '请确认仓库有可读取的 HEAD，或明确选择一个真实分支。',
      });
    }
    const selectedBranch = validateRepositoryBranch(requestedBranch || defaultBranch);
    if (!branches.includes(selectedBranch)) {
      throw new RepositoryGitError({
        code: 'REPOSITORY_BRANCH_NOT_FOUND',
        message: `仓库中不存在分支 ${selectedBranch}`,
        action: '请选择仓库返回的真实分支后重试。',
      });
    }
    const branchPattern = new RegExp(
      `^([a-f0-9]{40,64})\\s+refs/heads/${escapeRegex(selectedBranch)}$`,
      'mi',
    );
    const commitSha = headsOutput.stdout.match(branchPattern)?.[1]?.toLowerCase();
    if (!commitSha) {
      throw new RepositoryGitError({
        code: 'REPOSITORY_COMMIT_UNKNOWN',
        message: '无法解析分支的精确 commit',
        action: '请刷新仓库连接后重试。',
      });
    }
    return { defaultBranch, selectedBranch, commitSha, branches };
  }

  async checkout(
    repositoryUrl: string,
    branch: string,
    commitSha: string,
    credential: RepositoryCredentialMaterial,
    signal?: AbortSignal,
  ): Promise<RepositoryCheckout> {
    const root = await mkdtemp(`${tmpdir()}/devpilot-repository-analysis-`);
    const cleanup = () => this.cleanupWorkspace(root);
    try {
      await this.runGit(['init', '--quiet'], credential, root, signal);
      await this.runGit(['remote', 'add', 'origin', repositoryUrl], credential, root, signal);
      await this.runGit(
        ['fetch', '--quiet', '--depth=1', 'origin', `refs/heads/${validateRepositoryBranch(branch)}`],
        credential,
        root,
        signal,
      );
      const fetched = await this.runGit(['rev-parse', 'FETCH_HEAD'], credential, root, signal);
      if (fetched.stdout.trim().toLowerCase() !== commitSha.toLowerCase()) {
        throw new RepositoryGitError({
          code: 'REPOSITORY_COMMIT_MOVED',
          message: '分支在解析期间发生了变化',
          action: '请刷新连接并基于新的精确 commit 重新解析。',
        });
      }
      await this.runGit(['checkout', '--quiet', '--detach', commitSha], credential, root, signal);
      return { root, cleanup };
    } catch (error) {
      await cleanup();
      throw error;
    }
  }

  private async runGit(
    args: string[],
    credential: RepositoryCredentialMaterial,
    cwd?: string,
    signal?: AbortSignal,
  ): Promise<{ stdout: string; stderr: string }> {
    return this.command.run(args, credential, cwd, signal);
  }

  private localPath(repositoryUrl: string): string | null {
    if (repositoryUrl.startsWith('/')) return resolve(repositoryUrl);
    if (repositoryUrl.startsWith('file://')) return resolve(new URL(repositoryUrl).pathname);
    return null;
  }

  private async cleanupWorkspace(root: string): Promise<void> {
    if (!root.startsWith(`${tmpdir()}/devpilot-repository-analysis-`)) return;
    await rm(root, { recursive: true, force: true });
  }
}

function canonicalAllowedRoot(value: string): string {
  const resolved = resolve(value);
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
