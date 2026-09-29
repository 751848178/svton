import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planImageGc } from './gc.js';
import { ReleaseStore } from './release.js';
import { validateSpec } from '../shared/spec-schema.js';

test('plan protects every retained snapshot and only offers stale history refs (F34)', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-gc-'));
  const appsRoot = path.join(root, 'apps');
  const store = new ReleaseStore(appsRoot);
  const spec = validateSpec({ name: 'a' });

  const r1 = await store.saveRelease('app', 'reg/a:1', spec);
  const r2 = await store.saveRelease('app', 'reg/a:2', spec);
  await store.shift('app', r1.id, 'deploy');
  await store.shift('app', r2.id, 'deploy');

  // simulate a deploy whose snapshot has already been rotation-GC'd (only history remains)
  const st = await store.loadState('app');
  st.history.push({ releaseId: 'rotated-away', imageRef: 'reg/a:0', at: new Date().toISOString(), event: 'deploy' });
  await writeFile(path.join(appsRoot, 'app', 'state.json'), JSON.stringify(st, null, 2));

  const plan = await planImageGc(appsRoot);
  assert.deepEqual(plan.protectedRefs.sort(), ['reg/a:1', 'reg/a:2']);
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.candidates[0]?.imageRef, 'reg/a:0');
  assert.equal(plan.candidates[0]?.app, 'app');
});

test('no candidates when all history refs are still snapshotted', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-gc-'));
  const appsRoot = path.join(root, 'apps');
  const store = new ReleaseStore(appsRoot);
  const spec = validateSpec({ name: 'a' });
  const r1 = await store.saveRelease('app', 'reg/a:1', spec);
  await store.shift('app', r1.id, 'deploy');
  const plan = await planImageGc(appsRoot);
  assert.equal(plan.candidates.length, 0);
});
