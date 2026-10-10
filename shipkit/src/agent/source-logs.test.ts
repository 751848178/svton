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
  if (args.includes('ls-tree') || args.includes('grep')) {
    const stdout = args.includes('grep') ? (feature === 'lfs' && !args.includes('.gitattributes') ? 'HEAD:asset.bin\0' : '')
      : args.includes('-r') ? '100644\n' : feature === 'submodule' ? '100644\n' : '';
    opts?.onLine?.(stdout.trim(), 'out');
    opts?.onLine?.('machine check diagnostic', 'err');
    return { ...ok(stdout), code: args.includes('grep') && !stdout ? 1 : 0 };
  }
  if (args.includes('show')) {
    const stdout = `version https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize 1\n`;
    opts?.onLine?.(stdout, 'out'); opts?.onLine?.('machine check diagnostic', 'err');
    return ok(stdout);
  }
  if (args.includes('checkout')) opts?.onLine?.('normal checkout progress', 'out');
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
  assert.doesNotMatch(logs.join('\n'), /100644|HEAD:asset\.bin/);
  assert.ok(logs.includes('machine check diagnostic'), 'stderr diagnostics remain visible');
  assert.ok(logs.includes('normal checkout progress'), 'ordinary Git stdout remains visible');
  for (const { args, opts } of calls.filter(call => call.args.includes('ls-tree') || call.args.includes('grep') || call.args.includes('show'))) {
    assert.equal(opts?.maxBytes, 1024 * 1024, 'machine checks retain the original output cap');
    assert.ok(opts!.timeoutMs! > 0 && opts!.timeoutMs! <= 15_000);
    if (args.includes('ls-tree')) assert.ok(args.includes('--format=%(objectmode)'));
  }
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
    const logs: string[] = [];
    await assert.rejects(() => ensureSource(root, { type: 'git', repo: 'https://github.com/team/repo', token }, line => logs.push(line)), /not supported/);
    assert.doesNotMatch(logs.join('\n'), /100644|HEAD:asset\.bin|version https:\/\/git-lfs/);
    assert.ok(logs.includes('machine check diagnostic'));
    assert.ok(!existsSync(authFile));
  }
});
