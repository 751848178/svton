import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExecOptions } from '../shared/exec.js';

let calls: { args: string[]; opts?: ExecOptions }[] = [];
let loginFails = false;
mock.module('../shared/exec.js', { namedExports: { exec: async (_cmd: string, args: string[], opts?: ExecOptions) => {
  calls.push({ args, opts });
  if (args[0] === 'login') {
    await writeFile(path.join(opts!.env!.DOCKER_CONFIG!, 'config.json'), 'private-test-auth');
    if (loginFails) return { code: 1, stdout: '', stderr: 'unauthorized', truncated: false, timedOut: false };
  }
  return { code: 0, stdout: args[0] === 'image' ? 'sha256:test\tlinux/amd64' : '', stderr: '', truncated: false, timedOut: false };
} } });
const { dockerBuild, pullAuthCtx } = await import('./docker.js');

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  calls = []; loginFails = false;
  const root = await mkdtemp(path.join(tmpdir(), 'ship-build-boundary-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo'); const outside = path.join(root, 'outside');
  await mkdir(repo); await mkdir(outside);
  await writeFile(path.join(repo, 'Dockerfile'), 'FROM scratch\n');
  await writeFile(path.join(outside, 'Dockerfile'), 'FROM scratch\n');
  await symlink(outside, path.join(repo, 'escape'));
  await symlink(path.join(outside, 'Dockerfile'), path.join(repo, 'escaped-file'));
  return { root, repo, outside };
}

for (const kind of ['context-escape', 'dockerfile-escape', 'context-file', 'dockerfile-directory']) {
  test(`build rejects ${kind} before any Docker action`, async (t) => {
    const { repo } = await fixture(t);
    const contextDir = path.join(repo, kind === 'context-escape' ? 'escape' : kind === 'context-file' ? 'Dockerfile' : '.');
    const dockerfileAbs = path.join(repo, kind === 'dockerfile-escape' ? 'escaped-file' : kind === 'dockerfile-directory' ? '.' : 'Dockerfile');
    await assert.rejects(() => dockerBuild({ repoDir: repo, contextDir, dockerfileAbs, tag: 'ship-test:owned', buildArgs: {}, log: () => {} }), /source|directory|file/i);
    assert.equal(calls.length, 0);
  });
}

test('build allows contained aliases and repo-root Dockerfile outside a nested context', async (t) => {
  const { repo } = await fixture(t);
  await mkdir(path.join(repo, 'app'));
  await symlink(path.join(repo, 'app'), path.join(repo, 'app-alias'));
  await symlink(path.join(repo, 'Dockerfile'), path.join(repo, 'Dockerfile-alias'));
  const built = await dockerBuild({ repoDir: repo, contextDir: path.join(repo, 'app-alias'), dockerfileAbs: path.join(repo, 'Dockerfile-alias'), tag: 'ship-test:owned', buildArgs: {}, log: () => {} });
  assert.equal(built.arch, 'linux/amd64');
  assert.equal(calls[0]!.args.at(-1), await realpath(path.join(repo, 'app')));
  assert.equal(calls[0]!.args[calls[0]!.args.indexOf('-f') + 1], await realpath(path.join(repo, 'Dockerfile')));
});

test('failed pull login removes only its private Docker config including partial auth', async () => {
  calls = []; loginFails = true;
  await assert.rejects(() => pullAuthCtx('registry.example/test:tag', () => {}, { user: 'u', password: 'fake-password' }), /unauthorized/);
  const config = calls.find(c => c.args[0] === 'login')!.opts!.env!.DOCKER_CONFIG!;
  try {
    await assert.rejects(() => readFile(path.join(config, 'config.json')), { code: 'ENOENT' });
    await assert.rejects(() => stat(config), { code: 'ENOENT' });
  }
  finally { await rm(config, { recursive: true, force: true }); }
});
