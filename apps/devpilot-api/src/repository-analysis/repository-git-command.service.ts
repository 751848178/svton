import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { chmod, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { REPOSITORY_ANALYSIS_DEFAULTS } from './repository-analysis.constants';
import { mapGitFailure } from './repository-git-error.utils';
import { RepositoryCredentialMaterial } from './repository-analysis.types';
import { repositoryGitEnvironment } from './repository-git-environment.utils';

type GitAuth = { env: NodeJS.ProcessEnv; cleanup: () => Promise<void> };

@Injectable()
export class RepositoryGitCommandService {
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.timeoutMs = Number(config.get('REPOSITORY_ANALYSIS_GIT_TIMEOUT_MS'))
      || REPOSITORY_ANALYSIS_DEFAULTS.gitTimeoutMs;
  }

  async run(
    args: string[],
    credential: RepositoryCredentialMaterial,
    cwd?: string,
    signal?: AbortSignal,
  ): Promise<{ stdout: string; stderr: string }> {
    const auth = await this.createAuth(credential);
    try {
      return await executeGit(args, cwd, auth.env, this.timeoutMs, signal);
    } catch (error) {
      throw mapGitFailure(error, credential.kind === 'none' ? [] : [credential.secret]);
    } finally {
      await auth.cleanup();
    }
  }

  private async createAuth(credential: RepositoryCredentialMaterial): Promise<GitAuth> {
    const dir = await mkdtemp(`${tmpdir()}/devpilot-git-auth-`);
    const baseEnv = repositoryGitEnvironment(dir);
    if (credential.kind === 'none') {
      return {
        env: baseEnv,
        cleanup: () => rm(dir, { recursive: true, force: true }),
      };
    }
    if (credential.kind === 'https_token') {
      const askPass = `${dir}/askpass.sh`;
      await writeFile(
        askPass,
        '#!/bin/sh\ncase "$1" in *Username*) printf %s "$REPOSITORY_GIT_USERNAME";; *) printf %s "$REPOSITORY_GIT_SECRET";; esac\n',
      );
      await chmod(askPass, 0o700);
      return {
        env: {
          ...baseEnv,
          GIT_ASKPASS: askPass,
          REPOSITORY_GIT_USERNAME: credential.username,
          REPOSITORY_GIT_SECRET: credential.secret,
        },
        cleanup: () => rm(dir, { recursive: true, force: true }),
      };
    }
    const identity = `${dir}/identity`;
    await writeFile(identity, credential.secret);
    await chmod(identity, 0o600);
    return {
      env: {
        ...baseEnv,
        GIT_SSH_COMMAND: [
          'ssh',
          `-i ${identity}`,
          '-o IdentitiesOnly=yes',
          '-o StrictHostKeyChecking=accept-new',
          `-o UserKnownHostsFile=${dir}/known_hosts`,
        ].join(' '),
      },
      cleanup: () => rm(dir, { recursive: true, force: true }),
    };
  }
}

function executeGit(
  args: string[],
  cwd: string | undefined,
  env: NodeJS.ProcessEnv,
  timeout: number,
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, env, timeout, maxBuffer: 2 * 1024 * 1024, signal },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${error.message}\n${stderr}`));
        else resolve({ stdout, stderr });
      },
    );
  });
}
