import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import { assertSupportedGitTree, type GitCommand } from './git-command.js';

type TreeKind = 'plain' | 'empty-modules' | 'modules' | 'gitlink';
async function fixture(kind: TreeKind, action: (git: GitCommand, directory: string, logs: string[]) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-git-tree-'));
  const run = async (args: string[]) => {
    const result = await exec('git', args, { cwd: directory, timeoutMs: 10_000 });
    assert.equal(result.code, 0, result.stderr); return result.stdout.trim();
  };
  try {
    await run(['init', '--initial-branch=main']);
    await run(['config', 'user.name', 'Fixture']); await run(['config', 'user.email', 'fixture@example.invalid']);
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
    const logs: string[] = [];
    const git: GitCommand = { repo: directory, cleanup: async () => {},
      run: (args, timeoutMs) => exec('git', args, { cwd: directory, timeoutMs, onLine: line => logs.push(line) }) };
    await action(git, directory, logs);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('actual supported Git tree with no .gitmodules has no fatal existence-probe log', async () => {
  await fixture('plain', async (git, directory, logs) => {
    await assertSupportedGitTree(git, directory);
    assert(!logs.some(line => /fatal:/i.test(line)), JSON.stringify(logs));
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
