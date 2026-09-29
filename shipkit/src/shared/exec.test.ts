import test from 'node:test';
import assert from 'node:assert/strict';
import { exec } from './exec.js';

test('captures stdout and exit code', async () => {
  const r = await exec('echo', ['hi']);
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), 'hi');
});

test('kills the process on timeout', async () => {
  const r = await exec('sleep', ['5'], { timeoutMs: 200 });
  assert.equal(r.timedOut, true);
  assert.notEqual(r.code, 0);
});

test('streams complete lines via onLine', async () => {
  const lines: string[] = [];
  const r = await exec('printf', ['a\nb\n'], { onLine: (l) => lines.push(l) });
  assert.equal(r.code, 0);
  assert.deepEqual(lines, ['a', 'b']);
});

test('writes stdin without exposing it in argv', async () => {
  const r = await exec('cat', [], { stdin: 'secret' });
  assert.equal(r.stdout, 'secret');
});

test('reports spawn errors instead of throwing', async () => {
  const r = await exec('definitely-not-a-command-xyz', []);
  assert.equal(r.code, -1);
  assert.match(r.stderr, /spawn error/);
});
