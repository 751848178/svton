import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExecOptions } from '../shared/exec.js';

const realExec = await import('../shared/exec.js');
const policy = await import('../shared/git-policy.js');
mock.module('../shared/git-policy.js', { namedExports: { ...policy,
  resolveGitAddresses: async () => [{ address: '140.82.112.3', family: 4 }],
} });
const token = 'fake-token:/+secret';
let failure = '', feature = '', authFile = '', usernameFile = '', expectedToken = token, expectedUsername = 'x-access-token';
const calls: { args: string[]; opts?: ExecOptions }[] = [];
const ok = (stdout = '') => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
mock.module('../shared/exec.js', { namedExports: { ...realExec, exec: async (_cmd: string, args: string[], opts?: ExecOptions) => {
  calls.push({ args, opts });
  if (args.includes('--config')) return ok('http.curloptResolve\n');
  if (args.includes('clone') || args.includes('fetch')) {
    authFile = opts!.env!.SHIPKIT_GIT_CREDENTIAL_FILE!;
    usernameFile = opts!.env!.SHIPKIT_GIT_USERNAME_FILE!;
    assert.equal(await readFile(usernameFile, 'utf8'), expectedUsername);
    assert.equal((await stat(usernameFile)).mode & 0o777, 0o600);
    assert.equal(await readFile(authFile, 'utf8'), expectedToken);
    assert.equal((await stat(authFile)).mode & 0o777, 0o600);
    assert.equal((await stat(path.dirname(authFile))).mode & 0o777, 0o700);
    const credential = await realExec.exec('git', ['-c', 'credential.helper=', 'credential', 'fill'], { env: opts!.env,
      stdin: 'protocol=https\nhost=example.test\n\n' });
    assert.equal(credential.code, 0, credential.stderr);
    assert.ok(credential.stdout.includes(`username=${expectedUsername}\n`), 'username supplied through Git');
    assert.ok(credential.stdout.includes(`password=${expectedToken}\n`), 'token supplied through Git');
    opts?.onLine?.(`diagnostic ${token} ${encodeURIComponent(token)}`, 'err');
    if (failure) return { ...ok(), code: 1, timedOut: failure === 'timeout' };
  }
  if (args.includes('ls-tree')) return ok(`100644 blob ${'b'.repeat(40)}\t${feature === 'submodule' ? '.gitmodules' : 'README'}\n`);
  if (args.includes('grep')) return { ...ok(), code: feature === 'lfs' ? 0 : 1 };
  if (args.includes('rev-parse')) return ok('a'.repeat(40));
  return ok();
} } });
const { ensureSource } = await import('./source.js');

async function fixture(t: test.TestContext) {
  calls.length = 0; failure = ''; feature = ''; authFile = ''; usernameFile = ''; expectedToken = token; expectedUsername = 'x-access-token';
  const root = await mkdtemp(path.join(tmpdir(), 'ship-git-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('Git token stays out of argv, env, script, logs and remote; askpass works and cleans up', async t => {
  const root = await fixture(t), logs: string[] = [];
  const result = await ensureSource(root, { type: 'git', repo: 'https://github.com/team/repo', token }, line => logs.push(line));
  assert.equal(result.sha, 'a'.repeat(40));
  for (const { args, opts } of calls) {
    assert.ok(!args.join(' ').includes(token));
    assert.ok(!Object.values(opts?.env ?? {}).includes(token));
  }
  const clone = calls.find(call => call.args.includes('clone'))!;
  assert.ok(clone.args.includes('http.curloptResolve=github.com:443:140.82.112.3'));
  assert.ok(clone.args.includes('http.followRedirects=false'));
  assert.ok(clone.args.includes('https://github.com/team/repo'));
  assert.doesNotMatch(logs.join('\n'), /fake-token/);
  assert.ok(!existsSync(authFile) && !existsSync(usernameFile));
});

test('Builder source passes a custom Git username only through temporary askpass files', async t => {
  const root = await fixture(t); expectedUsername = 'gitlab+deploy-token-43';
  await ensureSource(root, { type: 'git', repo: 'https://github.com/team/repo', token, username: expectedUsername }, () => {});
  for (const { args, opts } of calls) {
    assert.ok(!args.join(' ').includes(expectedUsername));
    assert.ok(!Object.values(opts?.env ?? {}).includes(expectedUsername));
  }
  assert.ok(!existsSync(authFile) && !existsSync(usernameFile));
});

test('legacy public HTTPS source without a token remains supported', async t => {
  const root = await fixture(t); expectedToken = '';
  const result = await ensureSource(root, { type: 'git', repo: 'https://github.com/team/public' }, () => {});
  assert.equal(result.sha, 'a'.repeat(40));
  assert.ok(!existsSync(authFile));
});

test('clone failure and timeout remove temporary credentials and partial sources', async t => {
  const root = await fixture(t);
  for (const fail of ['error', 'timeout']) {
    failure = fail;
    await assert.rejects(() => ensureSource(root, { type: 'git', repo: 'https://github.com/team/repo', token }, () => {}), /failed/);
    assert.ok(!existsSync(authFile) && !existsSync(usernameFile));
  }
});

test('submodule and LFS repositories explicitly refuse and clean credentials', async t => {
  const root = await fixture(t);
  for (const dependency of ['submodule', 'lfs']) {
    feature = dependency;
    await assert.rejects(() => ensureSource(root, { type: 'git', repo: 'https://github.com/team/repo', token }, () => {}), /not supported/);
    assert.ok(!existsSync(authFile));
  }
});
