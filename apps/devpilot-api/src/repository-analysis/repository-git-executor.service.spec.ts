import { ConfigService } from '@nestjs/config';
import { mkdtemp, mkdir, realpath, rm, symlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { RepositoryGitExecutorService } from './repository-git-executor.service';
import type { RepositoryGitCommandService } from './repository-git-command.service';

describe('RepositoryGitExecutorService local root policy', () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('canonicalizes an allowlisted symlink but still rejects a sibling path', async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'git-root-policy-')));
    const target = join(root, 'target');
    const allowed = join(target, 'repository');
    const outside = join(root, 'outside');
    const link = join(root, 'allowed-link');
    await Promise.all([mkdir(allowed, { recursive: true }), mkdir(outside)]);
    await symlink(target, link);
    const service = new RepositoryGitExecutorService(
      new ConfigService({ REPOSITORY_ANALYSIS_LOCAL_ROOTS: link }),
      {} as RepositoryGitCommandService,
    );

    await expect(service.assertRepositorySourceAllowed(allowed)).resolves.toBeUndefined();
    await expect(service.assertRepositorySourceAllowed(outside)).rejects.toMatchObject({
      detail: { code: 'REPOSITORY_LOCAL_PATH_DISABLED' },
    });
  });
});
