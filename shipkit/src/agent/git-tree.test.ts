import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import { assertSupportedGitTree, type GitCommand } from './git-command.js';

type TreeKind = 'plain' | 'empty-modules' | 'modules' | 'gitlink' | 'lfs-pointer' | 'lfs-attributes'
  | 'lfs-crlf-pointer' | 'lfs-nested-attributes' | 'lfs-newline-path' | 'diagnostic-source' | 'crlf-diagnostic-source'
  | 'commented-attributes' | 'quoted-pattern' | 'pointer-text';
async function fixture(kind: TreeKind, action: (git: GitCommand, directory: string, logs: string[]) => Promise<void>, pointerContent?: string) {
  const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-git-tree-'));
  const run = async (args: string[]) => {
    const result = await exec('git', args, { cwd: directory, timeoutMs: 10_000 });
    assert.equal(result.code, 0, result.stderr); return result.stdout.trim();
  };
  try {
    await run(['init', '--initial-branch=main']);
    await run(['config', 'user.name', 'Fixture']); await run(['config', 'user.email', 'fixture@example.invalid']);
    await run(['config', 'core.autocrlf', 'false']);
    await writeFile(path.join(directory, 'README'), 'supported source\n');
    await run(['add', 'README']); await run(['commit', '-m', 'initial']);
    if (kind === 'empty-modules' || kind === 'modules') {
      await writeFile(path.join(directory, '.gitmodules'), kind === 'empty-modules' ? '' : '[submodule "nested"]\npath = nested\nurl = https://example.invalid/nested.git\n');
      await run(['add', '.gitmodules']); await run(['commit', '-m', 'modules']);
    }
    if (kind === 'gitlink') {
      const head = await run(['rev-parse', 'HEAD']);
      await run(['update-index', '--add', '--cacheinfo', `160000,${head},nested`]);
      await run(['commit', '-m', 'gitlink without modules']);
    }
    if (kind === 'lfs-pointer' || kind === 'lfs-crlf-pointer' || kind === 'lfs-newline-path' || kind === 'lfs-attributes') {
      const name = kind === 'lfs-pointer' || kind === 'lfs-crlf-pointer' ? 'asset.bin' : kind === 'lfs-newline-path' ? 'asset\nwith spaces.bin' : '.gitattributes';
      const content = pointerContent ?? (kind !== 'lfs-attributes'
        ? `version https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize 1\n`
        : '*.bin filter=lfs diff=lfs merge=lfs -text\n');
      await writeFile(path.join(directory, name), kind === 'lfs-crlf-pointer' ? content.replace(/\n/g, '\r\n') : content);
      await run(['add', name]); await run(['commit', '-m', 'LFS source']);
      if (kind === 'lfs-crlf-pointer') assert.ok((await run(['show', 'HEAD:asset.bin'])).includes('/spec/v1\r\n'));
    }
    if (kind === 'lfs-nested-attributes') {
      await mkdir(path.join(directory, 'nested'));
      await writeFile(path.join(directory, 'nested/.gitattributes'), '*.bin filter=lfs\n');
      await run(['add', 'nested/.gitattributes']); await run(['commit', '-m', 'nested attributes']);
    }
    if (['diagnostic-source', 'crlf-diagnostic-source', 'commented-attributes', 'quoted-pattern', 'pointer-text'].includes(kind)) {
      const name = kind.includes('diagnostic-source') ? 'ordinary-source.ts' : kind === 'pointer-text' ? 'docs.txt' : '.gitattributes';
      const contents = kind.includes('diagnostic-source') ? 'const diagnostic = "filter=lfs|version https://git-lfs.github.com/spec/v1";\n'
        : kind === 'commented-attributes' ? '# *.bin filter=lfs\n  # ignored filter=lfs\n*.txt text\n'
        : kind === 'quoted-pattern' ? '"file filter=lfs " text\n'
        : `Documentation before a pointer example:\nversion https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize 1\n`;
      await writeFile(path.join(directory, name), kind === 'crlf-diagnostic-source' ? contents.replace(/\n/g, '\r\n') : contents);
      await run(['add', name]); await run(['commit', '-m', 'ordinary text']);
    }
    const logs: string[] = [];
    const git: GitCommand = { repo: directory, cleanup: async () => {},
      run: (args, timeoutMs, options) => exec('git', args, { cwd: directory, timeoutMs, maxBytes: 1024 * 1024,
        onLine: (line, stream) => { if (stream === 'err' || options?.logStdout !== false) logs.push(line); } }) };
    await action(git, directory, logs);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('actual supported Git tree with no .gitmodules has no fatal existence-probe log', async () => {
  await fixture('plain', async (git, directory, logs) => {
    await assertSupportedGitTree(git, directory);
    assert.deepEqual(logs, [], 'successful machine checks do not print tree or LFS metadata');
  });
});

for (const kind of ['empty-modules', 'modules', 'gitlink'] as const) {
  test(`actual ${kind} tree is rejected as unsupported submodules`, async () => {
    await fixture(kind, async (git, directory, logs) => {
      await assert.rejects(assertSupportedGitTree(git, directory), /submodules are not supported/);
      assert(!logs.some(line => /fatal:/i.test(line)), JSON.stringify(logs));
    });
  });
}

for (const kind of ['lfs-pointer', 'lfs-crlf-pointer', 'lfs-attributes', 'lfs-nested-attributes', 'lfs-newline-path'] as const) {
  test(`actual ${kind} tree remains rejected as unsupported LFS`, async () => {
    await fixture(kind, async (git, directory, logs) => {
      await assert.rejects(assertSupportedGitTree(git, directory), /Git LFS is not supported/);
      assert.deepEqual(logs, [], 'LFS matching file names stay out of job logs');
    });
  });
}

const pointerText = `version https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize 1\n`;
for (const [name, content] of [
  ['leading blank/whitespace', '\n \t' + pointerText],
  ['internal blank lines', pointerText.replace(/\n/g, '\n\n')],
  ['Unicode leading whitespace', '\u0085\u00a0' + pointerText],
  ['signed size', pointerText.replace('size 1', 'size +1')],
  ['zero-padded size', pointerText.replace('size 1', 'size 01')],
  ['negative zero size', pointerText.replace('size 1', 'size -0')],
  ['alpha alias', pointerText.replace('https://git-lfs.github.com/spec/v1', 'http://git-media.io/v/2')],
] as const) {
  test(`actual decoder-compatible ${name} pointer is rejected`, async () => {
    await fixture('lfs-pointer', async (git, directory, logs) => {
      await assert.rejects(assertSupportedGitTree(git, directory), /Git LFS is not supported/);
      assert.deepEqual(logs, []);
    }, content);
  });
}

for (const kind of ['diagnostic-source', 'crlf-diagnostic-source', 'commented-attributes', 'quoted-pattern', 'pointer-text'] as const) {
  test(`actual ${kind} text remains supported without false LFS detection`, async () => {
    await fixture(kind, async (git, directory, logs) => {
      await assertSupportedGitTree(git, directory);
      assert.deepEqual(logs, []);
    });
  });
}

test('actual large supported tree fits the unchanged 1MiB budget with compact metadata', async () => {
  await fixture('plain', async (git, directory, logs) => {
    const blob = await exec('git', ['-C', directory, 'hash-object', '-w', '--stdin'], { stdin: 'large-tree fixture\n' });
    assert.equal(blob.code, 0, blob.stderr);
    const input = Array.from({ length: 9000 }, (_, i) => `100644 blob ${blob.stdout.trim()}\tf${String(i).padStart(5, '0')}-${'x'.repeat(100)}\n`).join('');
    const tree = await exec('git', ['-C', directory, 'mktree'], { stdin: input, timeoutMs: 15_000 });
    assert.equal(tree.code, 0, tree.stderr);
    const commit = await exec('git', ['-C', directory, 'commit-tree', tree.stdout.trim(), '-m', 'large tree']);
    assert.equal(commit.code, 0, commit.stderr);
    const update = await exec('git', ['-C', directory, 'update-ref', 'HEAD', commit.stdout.trim()]);
    assert.equal(update.code, 0, update.stderr);
    const old = await git.run(['-C', directory, 'ls-tree', '-r', '--full-tree', 'HEAD'], 15_000, { logStdout: false });
    assert.equal(old.code, 0, old.stderr);
    assert.equal(old.stdout.length, 1024 * 1024);
    assert.equal(old.truncated, true, 'full filename/hash output exceeds the same capture cap');
    const compact = await git.run(['-C', directory, 'ls-tree', '-r', '--full-tree', '--format=%(objectmode)', 'HEAD'], 15_000, { logStdout: false });
    assert.equal(compact.code, 0, compact.stderr);
    assert.equal(compact.truncated, false);
    assert.equal(compact.stdout, '100644\n'.repeat(9000));
    await assertSupportedGitTree(git, directory);
    assert.deepEqual(logs, []);
  });
});

test('unsupported formatting, unknown/malformed metadata and bounded failures all refuse', async () => {
  const ok = { code: 0, stdout: '100644\n', stderr: '', truncated: false, timedOut: false };
  for (const [stage, overrides, message] of [
    ['tree', { code: 129, stderr: 'unknown option --format' }, /must support ls-tree --format/],
    ['tree', { timedOut: true }, /tree check failed/],
    ['tree', { truncated: true }, /bounded capture limit/],
    ['tree', { stdout: '100664\n' }, /unexpected object modes/],
    ['tree', { stdout: '100644' }, /unexpected object modes/],
    ['tree', { stdout: '100644\n\n' }, /unexpected object modes/],
    ['modules', { stdout: 'unexpected\n' }, /unexpected metadata/],
    ['modules', { stdout: '100644\n\n' }, /unexpected metadata/],
    ['modules', { truncated: true }, /bounded capture limit/],
    ['modules', { timedOut: true }, /timeout/],
    ['lfs', { code: 1, truncated: true }, /LFS support check failed/],
    ['lfs', { code: 1, timedOut: true }, /LFS support check failed/],
    ['lfs', { code: 2 }, /LFS support check failed/],
  ] as const) {
    const calls: string[] = [];
    const git: GitCommand = { repo: 'fixture', cleanup: async () => {}, run: async (args, timeoutMs, options) => {
      const current = args.includes('grep') ? 'lfs' : args.includes('-r') ? 'tree' : 'modules';
      calls.push(current);
      assert.ok(timeoutMs! > 0 && timeoutMs! <= 15_000); assert.equal(options?.logStdout, false);
      const result = current === 'tree' ? ok : { ...ok, stdout: '', code: current === 'lfs' ? 1 : 0 };
      return current === stage ? { ...result, ...overrides } : result;
    } };
    await assert.rejects(assertSupportedGitTree(git, 'fixture'), message);
    assert.equal(calls.at(-1), stage, 'no fallback or later check runs after an unsafe result');
  }
});
