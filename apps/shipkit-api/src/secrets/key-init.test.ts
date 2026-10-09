import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('key initialization is explicit and never overwrites existing material', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-key-init-test-'));
  const filename = path.join(directory, 'private', 'keys.json');
  const env = { ...process.env, SHIPKIT_SECRET_KEY_FILE: filename, DATABASE_URL: `file:${path.join(directory, 'empty.db')}` };
  const run = (args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'src/secrets/key-init.cli.ts', ...args], { encoding: 'utf8', env });
  try {
    assert.equal(run([]).status, 1);
    assert.equal(run(['init']).status, 0);
    const original = await readFile(filename, 'utf8');
    assert.equal((await stat(filename)).mode & 0o777, 0o600);
    assert.equal(run(['init']).status, 1);
    assert.equal(await readFile(filename, 'utf8'), original);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
