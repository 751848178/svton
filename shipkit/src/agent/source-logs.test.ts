import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ExecOptions } from '../shared/exec.js';

const fakeToken = 'fake-token:/+secret';
const embeddedPassword = 'fake-embedded-password';
let fail = false;
const commands: string[][] = [];
mock.module('../shared/exec.js', { namedExports: { exec: async (_cmd: string, args: string[], opts?: ExecOptions) => {
  commands.push(args);
  opts?.onLine?.(`diagnostic https://user:${embeddedPassword}@example.test/repo ${embeddedPassword} ${fakeToken} ${encodeURIComponent(fakeToken)}`, 'err');
  return { code: fail ? 1 : 0, stdout: '', stderr: '', truncated: false, timedOut: false };
} } });
const { ensureSource } = await import('./source.js');

test('Git progress and subprocess logs remove embedded URL and explicit token credentials', async (t) => {
  fail = true; commands.length = 0;
  const root = await mkdtemp(path.join(tmpdir(), 'ship-source-logs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const logs: string[] = [];
  await assert.rejects(() => ensureSource(root, { type: 'git', repo: `https://user:${embeddedPassword}@example.test/repo`, token: fakeToken }, line => logs.push(line)), /failed/);
  assert.ok(logs.length > 0);
  assert.doesNotMatch(logs.join('\n'), /fake-embedded-password|fake-token|fake-token%3A/i);
});

test('embedded URL credentials are removed from the persisted Git remote after clone', async (t) => {
  fail = false; commands.length = 0;
  const root = await mkdtemp(path.join(tmpdir(), 'ship-source-remote-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await ensureSource(root, { type: 'git', repo: `https://user:${embeddedPassword}@example.test/repo` }, () => {});
  const setUrl = commands.find(args => args.includes('set-url'));
  assert.ok(setUrl, 'clone must clear URL credentials from its remote');
  assert.equal(setUrl.at(-1), 'https://example.test/repo');
});
