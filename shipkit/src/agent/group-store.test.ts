// GroupStore (MS-03): full-combination snapshots round-trip with private envs,
// corrupt anything refuses, and the v1↔v2 layout boundary is strict.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GroupStore } from './group-store.js';
import { writeFileAtomic } from './atomic.js';

async function store(): Promise<{ s: GroupStore; root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-groupstore-'));
  return { s: new GroupStore(path.join(root, 'apps')), root };
}

const combo = (imageRef: string) => ({
  backend: { imageRef, spec: { target: 'prod' } as never, hasEnv: true, env: 'SECRET=1\n' },
  admin: { imageRef, spec: {} as never, hasEnv: false },
});

test('save → load round-trips the full combination including private envs, parent and changed set', async (t) => {
  const { s, root } = await store();
  t.after(() => rm(root, { recursive: true, force: true }));
  await s.claimLayout('g');
  const rel = await s.saveRelease('g', { parent: null, changedServices: ['backend', 'admin'], services: combo('reg/ns/x:1') });
  assert.ok(/^[a-z0-9-]{6,40}$/.test(rel.id));
  const loaded = await s.loadRelease('g', rel.id);
  assert.equal(loaded.parent, null);
  assert.deepEqual(loaded.changedServices, ['backend', 'admin']);
  assert.equal(loaded.services.backend?.env, 'SECRET=1\n');
  assert.equal(loaded.services.admin?.env, undefined);
  // env lives in a 0600 private file, not in the manifest
  const manifest = await readFile(path.join(s.appDir('g'), 'releases', rel.id, 'manifest.json'), 'utf8');
  assert.ok(!manifest.includes('SECRET'), 'manifest never contains env content');
});

test('repository aliases round-trip immutable snapshots without renaming runtime services or older snapshots', async (t) => {
  const { s, root } = await store();
  t.after(() => rm(root, { recursive: true, force: true }));
  await s.claimLayout('shipkit');
  const old = await s.saveRelease('shipkit', { parent: null, changedServices: ['server'], services: {
    server: { imageRef: 'reg/ns/server:old', spec: {}, hasEnv: false },
  } });
  const next = await s.saveRelease('shipkit', { parent: old.id, changedServices: ['server'], services: {
    server: { imageRef: 'reg/ns/shipkit-server:new', spec: { imageRepository: 'shipkit-server' }, hasEnv: false },
  } });
  const loaded = await s.loadRelease('shipkit', next.id);
  assert.deepEqual(Object.keys(loaded.services), ['server']);
  assert.equal(loaded.services.server?.spec.imageRepository, 'shipkit-server');
  assert.equal(loaded.services.server?.imageRef, 'reg/ns/shipkit-server:new');
  assert.deepEqual((await s.loadRelease('shipkit', old.id)).services.server?.spec, {});
});

test('shift moves current/previous and records changedServices history; rollback events included', async (t) => {
  const { s, root } = await store();
  t.after(() => rm(root, { recursive: true, force: true }));
  await s.claimLayout('g');
  const r1 = await s.saveRelease('g', { parent: null, changedServices: ['backend'], services: combo('x:1') });
  await s.shift('g', r1.id, 'deploy');
  const r2 = await s.saveRelease('g', { parent: r1.id, changedServices: ['admin'], services: combo('x:2') });
  await s.shift('g', r2.id, 'deploy');
  const st = await s.loadState('g');
  assert.equal(st.current, r2.id);
  assert.equal(st.previous, r1.id);
  assert.deepEqual(st.history[0]?.changedServices, ['admin']);
  const r3 = await s.saveRelease('g', { parent: r2.id, changedServices: ['admin'], services: combo('x:1') });
  await s.shift('g', r3.id, 'rollback');
  assert.equal((await s.loadState('g')).history[0]?.event, 'rollback');
});

test('corrupt state refuses with a preserve-and-restore message; missing state is fresh', async (t) => {
  const { s, root } = await store();
  t.after(() => rm(root, { recursive: true, force: true }));
  const fresh = await s.loadState('nope');
  assert.equal(fresh.current, null);
  await mkdir(path.join(s.appDir('g')), { recursive: true });
  await writeFile(path.join(s.appDir('g'), 'state.json'), '{ broken', 'utf8');
  await assert.rejects(() => s.loadState('g'), /corrupt/);
});

test('corrupt manifest / missing env of hasEnv=true refuse; tampered ids refuse', async (t) => {
  const { s, root } = await store();
  t.after(() => rm(root, { recursive: true, force: true }));
  await s.claimLayout('g');
  const rel = await s.saveRelease('g', { parent: null, changedServices: ['backend'], services: combo('x:1') });
  const dir = path.join(s.appDir('g'), 'releases', rel.id);
  await rm(path.join(dir, 'env', 'backend'));
  await assert.rejects(() => s.loadRelease('g', rel.id), /env snapshot.*missing/);
  const rel2 = await s.saveRelease('g', { parent: rel.id, changedServices: ['admin'], services: combo('x:2') });
  const mfile = path.join(s.appDir('g'), 'releases', rel2.id, 'manifest.json');
  const manifest = JSON.parse(await readFile(mfile, 'utf8')) as Record<string, unknown>;
  manifest.id = 'tampered';
  await writeFileAtomic(mfile, JSON.stringify(manifest));
  await assert.rejects(() => s.loadRelease('g', rel2.id), /corrupt/);
});

test('v1 evidence under the same name refuses v2 (no auto-migration); claimLayout is idempotent', async (t) => {
  const { s, root } = await store();
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.doesNotReject(() => s.assertLayout('g'));
  await mkdir(s.appDir('g'), { recursive: true });
  await writeFile(path.join(s.appDir('g'), 'state.json'), JSON.stringify({ current: null, previous: null, history: [] }));
  await assert.rejects(() => s.assertLayout('g'), /v1 单服务部署痕迹/);
  // a fresh v2 claim writes the marker and re-claim is a no-op
  await s.claimLayout('h');
  await s.claimLayout('h');
  await assert.doesNotReject(() => s.assertLayout('h'));
  // marker corruption refuses instead of guessing
  await writeFile(path.join(s.appDir('h'), 'group.json'), 'not json');
  await assert.rejects(() => s.assertLayout('h'), /组标记/);
});

test('gc keeps 10 releases beyond current+previous', async (t) => {
  const { s, root } = await store();
  t.after(() => rm(root, { recursive: true, force: true }));
  await s.claimLayout('g');
  let prev: string | null = null;
  for (let i = 0; i < 14; i++) {
    const r = await s.saveRelease('g', { parent: prev, changedServices: ['backend'], services: combo(`x:${i}`) });
    await s.shift('g', r.id, 'deploy');
    prev = r.id;
  }
  const { readdir } = await import('node:fs/promises');
  const kept = (await readdir(path.join(s.appDir('g'), 'releases'))).length;
  assert.ok(kept <= 12, `expected bounded retention, got ${kept}`);
});
