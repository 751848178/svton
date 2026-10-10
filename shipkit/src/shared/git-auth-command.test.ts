import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createGitAuth } from './git-auth.js';
import { exec } from './exec.js';

test('real Git accepts executable and helper paths containing spaces and quotes', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-askpass-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = path.join(root, 'installed path \'single\' "double" $dollar');
  await import('node:fs/promises').then(fs => fs.mkdir(folder));
  for (const file of ['git-auth.js', 'git-askpass.js']) await copyFile(new URL(file, import.meta.url), path.join(folder, file));
  await writeFile(path.join(folder, 'package.json'), '{"type":"module"}\n');
  const node = path.join(folder, 'node \'single\' "double"');
  await symlink(process.execPath, node);
  const module = await import(pathToFileURL(path.join(folder, 'git-auth.js')).href) as typeof import('./git-auth.js');
  const auth = await module.createGitAuth('fixture-password', 'fixture-username');
  try {
    const result = await exec('git', [...auth.gitArgs, 'credential', 'fill'], {
      env: { ...auth.env, GIT_ASKPASS: node }, stdin: 'protocol=https\nhost=fixture.test\n\n',
    });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(result.stdout.includes('username=fixture-username\n'));
    assert.ok(result.stdout.includes('password=fixture-password\n'));
    assert.deepEqual((await readdir(path.dirname(auth.env.SHIPKIT_GIT_CREDENTIAL_FILE!))).sort(), ['credential', 'username']);
    assert.ok(!Object.values(auth.env).some(value => value?.includes('fixture-password')));
  } finally { await auth.cleanup(); }
  await assert.rejects(() => stat(auth.env.SHIPKIT_GIT_CREDENTIAL_FILE!), { code: 'ENOENT' });
  assert.ok((await stat(path.join(folder, 'git-askpass.js'))).isFile());
});

test('fixed preload replaces inherited Node options only in child env and stays inert for other Node commands', async () => {
  const previous = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = '--trace-warnings';
  const auth = await createGitAuth('fixture-password');
  try {
    assert.equal(process.env.NODE_OPTIONS, '--trace-warnings');
    assert.ok(auth.env.NODE_OPTIONS?.startsWith('--import=file:'));
    assert.ok(!auth.env.NODE_OPTIONS?.includes('--trace-warnings'));
    const result = await exec(process.execPath, ['-e', 'process.stdout.write("non-prompt-command-completed")'], { env: auth.env });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, 'non-prompt-command-completed');
    assert.ok(!result.stdout.includes('fixture-password'));
  } finally {
    await auth.cleanup();
    if (previous === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = previous;
  }
});

test('concurrent repository invocations keep credentials separate and cleanup does not affect another source', async () => {
  const first = await createGitAuth('fixture-first-token', 'fixture-first-user');
  const second = await createGitAuth('fixture-second-token', 'fixture-second-user');
  const credential = (auth: Awaited<ReturnType<typeof createGitAuth>>, host: string) =>
    exec('git', [...auth.gitArgs, 'credential', 'fill'], { env: auth.env, stdin: `protocol=https\nhost=${host}\n\n` });
  try {
    const [a, b] = await Promise.all([credential(first, 'first.test'), credential(second, 'second.test')]);
    assert.equal(a.code, 0); assert.equal(b.code, 0);
    assert.ok(a.stdout.includes('password=fixture-first-token\n') && !a.stdout.includes('fixture-second-token'));
    assert.ok(b.stdout.includes('password=fixture-second-token\n') && !b.stdout.includes('fixture-first-token'));
    await first.cleanup();
    const remaining = await credential(second, 'second.test');
    assert.equal(remaining.code, 0); assert.ok(remaining.stdout.includes('password=fixture-second-token\n'));
  } finally { await Promise.all([first.cleanup(), second.cleanup()]); }
});
