import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ReleaseStore } from './release.js';
import { validateSpec } from '../shared/spec-schema.js';

async function store(): Promise<{ s: ReleaseStore; root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-release-'));
  return { s: new ReleaseStore(root), root };
}

test('release snapshots round-trip spec + env; env kept separate from meta (F02)', async () => {
  const { s } = await store();
  const spec = validateSpec({ name: 'a', ports: ['3000:3000'] });
  const rel = await s.saveRelease('app', 'reg/a:1', spec, 'SECRET=1\n');
  const loaded = await s.loadRelease('app', rel.id);
  assert.equal(loaded.imageRef, 'reg/a:1');
  assert.equal(loaded.env, 'SECRET=1\n');
  assert.deepEqual(loaded.spec.ports, ['3000:3000']);
});

test('shift tracks current/previous release ids (F02)', async () => {
  const { s } = await store();
  const spec = validateSpec({ name: 'a' });
  const r1 = await s.saveRelease('app', 'reg/a:1', spec);
  const r2 = await s.saveRelease('app', 'reg/a:2', spec);
  await s.shift('app', r1.id, 'deploy');
  await s.shift('app', r2.id, 'deploy');
  const st = await s.loadState('app');
  assert.equal(st.current, r2.id);
  assert.equal(st.previous, r1.id);
  assert.equal(st.history.length, 2);
});

test('corrupt state.json is an error, not a silent first-deploy (F33)', async () => {
  const { s, root } = await store();
  await mkdtemp(root); // noop keep root
  await writeFile(path.join(root, 'app', 'state.json'), 'not json', { flag: 'w' }).catch(async () => {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.join(root, 'app'), { recursive: true });
    await writeFile(path.join(root, 'app', 'state.json'), 'not json');
  });
  await assert.rejects(() => s.loadState('app'), /corrupt/);
});

test('rollback swap restores previous as current', async () => {
  const { s } = await store();
  const spec = validateSpec({ name: 'a' });
  const r1 = await s.saveRelease('app', 'reg/a:1', spec);
  const r2 = await s.saveRelease('app', 'reg/a:2', spec);
  await s.shift('app', r1.id, 'deploy');
  await s.shift('app', r2.id, 'deploy');
  await s.shift('app', r1.id, 'rollback');
  const st = await s.loadState('app');
  assert.equal(st.current, r1.id);
  assert.equal(st.previous, r2.id);
});

test('list reports apps with resolved image refs and release ids', async () => {
  const { s } = await store();
  const spec = validateSpec({ name: 'a' });
  const r1 = await s.saveRelease('app', 'reg/a:1', spec);
  await s.shift('app', r1.id, 'deploy');
  const apps = await s.list();
  assert.equal(apps.length, 1);
  assert.equal(apps[0]?.app, 'app');
  assert.equal(apps[0]?.current, 'reg/a:1');
  assert.equal(apps[0]?.currentReleaseId, r1.id);
});
