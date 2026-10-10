import test from 'node:test';
import assert from 'node:assert/strict';
import { assertNoGitLfs } from './git-lfs-check.js';
import type { GitCommand } from './git-command-types.js';
import type { ExecResult } from '../shared/exec.js';

const ok = (stdout = ''): ExecResult => ({ code: 0, stdout, stderr: '', truncated: false, timedOut: false });
function command(output: (args: string[]) => ExecResult) {
  const calls: string[][] = [];
  const git: GitCommand = { repo: 'fixture', cleanup: async () => {}, run: async (args, timeoutMs, options) => {
    calls.push(args); assert.ok(timeoutMs! > 0 && timeoutMs! <= 15_000); assert.equal(options?.logStdout, false);
    return output(args);
  } };
  return { git, calls };
}
const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize 1\n`;

test('pointer requires first-line version and valid oid/size structure, including extensions', async () => {
  for (const content of [
    'prefix\n' + pointer, pointer.replace('sha256:', 'sha1:'), pointer.replace('size 1', 'size -1'),
    pointer.replace('size 1', 'size 9223372036854775808'), pointer + 'ordinary documentation\n',
  ]) {
    const { git } = command(args => args.includes('show') ? ok(content)
      : args.includes('.gitattributes') ? { ...ok(), code: 1 } : ok('HEAD:asset.bin\0'));
    await assertNoGitLfs(git, 'fixture');
  }
  for (const content of [pointer, pointer.replace('oid ', `ext-0-test sha256:${'b'.repeat(64)}\noid `)]) {
    const { git } = command(args => args.includes('show') ? ok(content)
      : args.includes('.gitattributes') ? { ...ok(), code: 1 } : ok('HEAD:asset.bin\0'));
    await assert.rejects(assertNoGitLfs(git, 'fixture'), /Git LFS is not supported/);
  }
  for (const content of [
    pointer.replace('oid ', '\noid '), '\u0085\t' + pointer,
    pointer.replace('size 1', 'size +01'), pointer.replace('size 1', 'size -0'),
    pointer.replace('https://git-lfs.github.com/spec/v1', 'http://git-media.io/v/2'),
    `ext-0-test sha256:${'b'.repeat(64)}\n` + pointer,
  ]) {
    const { git } = command(args => args.includes('show') ? ok(content)
      : args.includes('.gitattributes') ? { ...ok(), code: 1 } : ok('HEAD:asset.bin\0'));
    await assert.rejects(assertNoGitLfs(git, 'fixture'), /Git LFS is not supported/);
  }
});

test('candidate metadata is strictly NUL-delimited and attribute paths must be actual attribute files', async () => {
  for (const output of ['HEAD:asset.bin\n', 'asset.bin\0', 'HEAD:\0', 'HEAD:asset.bin\0\0']) {
    const { git, calls } = command(() => ok(output));
    await assert.rejects(assertNoGitLfs(git, 'fixture'), /metadata|candidate/);
    assert.equal(calls.length, 1);
  }
  const { git } = command(args => args.includes('.gitattributes') ? ok('HEAD:ordinary-source.ts\0') : { ...ok(), code: 1 });
  await assert.rejects(assertNoGitLfs(git, 'fixture'), /unrelated attribute file/);
});

test('candidate quota caps immutable blob reads instead of allowing an unbounded process loop', async () => {
  const names = Array.from({ length: 129 }, (_, index) => `HEAD:asset-${index}\0`).join('');
  const { git, calls } = command(() => ok(names));
  await assert.rejects(assertNoGitLfs(git, 'fixture'), /candidate limit/);
  assert.equal(calls.length, 1);
});

test('query and blob failures, timeouts and truncation always fail closed', async () => {
  for (const stage of ['query', 'blob']) for (const override of [
    { code: 2 }, { timedOut: true }, { truncated: true }, { stdout: 'x'.repeat(1024 * 1024 + 1) },
  ]) {
    const { git } = command(args => {
      if (stage === 'query' || args.includes('show')) return { ...ok(), ...override };
      return args.includes('.gitattributes') ? { ...ok(), code: 1 } : ok('HEAD:asset.bin\0');
    });
    await assert.rejects(assertNoGitLfs(git, 'fixture'), /LFS support check failed/);
  }
  const { git } = command(() => ({ ...ok('unexpected'), code: 1 }));
  await assert.rejects(assertNoGitLfs(git, 'fixture'), /unexpected metadata/);
});

test('aggregate capture budget spans candidate lists and multiple blobs', async () => {
  const { git, calls } = command(args => args.includes('show') ? ok('ordinary '.repeat(70_000))
    : args.includes('.gitattributes') ? { ...ok(), code: 1 } : ok('HEAD:one\0HEAD:two\0'));
  await assert.rejects(assertNoGitLfs(git, 'fixture'), /bounded capture limit/);
  assert.equal(calls.filter(args => args.includes('show')).length, 2);
});

test('aggregate deadline can expire before any child is launched', async t => {
  let first = true;
  t.mock.method(Date, 'now', () => { if (first) { first = false; return 0; } return 15_001; });
  const { git, calls } = command(() => ok());
  await assert.rejects(assertNoGitLfs(git, 'fixture'), /timeout/);
  assert.equal(calls.length, 0);
});
