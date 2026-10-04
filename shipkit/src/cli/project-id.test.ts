import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { ShipConfig } from '../shared/types.js';

const remotes = new Map<string, string>();
mock.module('../shared/git.js', { namedExports: { gitRemote: async (cwd: string) => remotes.get(cwd) ?? null } });
const { normalizeRepoUrl, resolveProjectId } = await import('./project-id.js');

test('Git transport aliases unify without collapsing a nondefault port into a path', () => {
  for (const url of ['git@EXAMPLE.com:team/web.git', 'https://user:secret@example.com/team/web.git/', 'ssh://git@example.com:22/team/web.git', 'git://example.com:9418/team/web.git']) {
    assert.equal(normalizeRepoUrl(url), 'example.com/team/web', url);
  }
  assert.notEqual(normalizeRepoUrl('ssh://example.com:2222/team/web.git'), normalizeRepoUrl('https://example.com/2222/team/web.git'));
  assert.notEqual(normalizeRepoUrl('https://example.com/team/Web.git'), normalizeRepoUrl('https://example.com/team/web.git'));
});

test('explicit Git source wins for Git builds; local uploads bind to their actual directory', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-identity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const uploaded = path.join(root, 'other source');
  await mkdir(uploaded);
  remotes.set(root, 'git@origin.example:team/controller.git');
  remotes.set(uploaded, 'git@origin.example:team/uploaded.git');
  const config = { source: { repo: 'https://source.example/team/configured.git' } } as ShipConfig;
  assert.equal(await resolveProjectId(root, config), 'source.example/team/configured');
  assert.equal(await resolveProjectId(root), 'origin.example/team/controller');
  assert.equal(await resolveProjectId(root, config, 'other source'), 'origin.example/team/uploaded');
  remotes.delete(uploaded);
  assert.match(await resolveProjectId(root, config, uploaded), /^local:[0-9a-f]{32}$/);
});

test('long and spaced paths/remotes fit the identity protocol and symlink aliases stay stable', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-local-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = path.join(root, 'long path '.repeat(20));
  await mkdir(dir);
  const alias = path.join(root, 'alias');
  await symlink(dir, alias);
  assert.equal(await resolveProjectId(dir), await resolveProjectId(alias));
  assert.match(await resolveProjectId(dir), /^local:[0-9a-f]{32}$/);
  assert.match(await resolveProjectId(dir, { source: { repo: `https://host/${'a'.repeat(220)}.git` } } as ShipConfig), /^repo:[0-9a-f]{64}$/);
});
