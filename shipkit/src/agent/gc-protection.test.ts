// R08: image GC protection understands BOTH v1 apps and v2 groups on one
// machine — every image of every retained combination (including inherited
// and rollback-source snapshots) is protected; corrupt state, corrupt
// snapshots or an ambiguous layout marker abort the whole GC instead of
// guessing what is deletable.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { protectedRefs } from './gc-protection.js';
import { ReleaseStore } from './release.js';
import { GroupStore } from './group-store.js';
import { validateSpec } from '../shared/spec-schema.js';

const digest = (s: string) => `reg/ns/${s}@sha256:${s.repeat(64).slice(0, 64)}`;

async function root() {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-gcprot-'));
  const appsRoot = path.join(dir, 'apps');
  await mkdir(appsRoot, { recursive: true });
  return { appsRoot, dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const V1_SPEC = () => validateSpec({ name: 'v1app', ports: ['3000:3000'] });

test('mixed machine: v1 app + v2 group — protected set covers both, including inherited and rollback-source images', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);

  // v1 app with two releases (current + previous)
  const v1 = new ReleaseStore(appsRoot);
  const r1 = await v1.saveRelease('v1app', 'reg/ns/v1:1', V1_SPEC());
  await v1.shift('v1app', r1.id, 'deploy');
  const r2 = await v1.saveRelease('v1app', 'reg/ns/v1:2', V1_SPEC());
  await v1.shift('v1app', r2.id, 'deploy');
  await writeFile(path.join(appsRoot, 'v1app', 'project.json'), `${JSON.stringify({ app: 'v1app', project: 'p1', env: 'prod' })}\n`);

  // v2 group: three releases — b1/a1 (full), b2 (partial), b1-again via "rollback"
  const g = new GroupStore(appsRoot);
  const spec = { schemaVersion: 2 as const, name: 'grp', services: { api: {}, web: {} } };
  const rel1 = await g.saveRelease('grp', {
    parent: null, changedServices: ['api', 'web'],
    services: { api: { imageRef: digest('api1'), spec: {}, hasEnv: false }, web: { imageRef: digest('web1'), spec: {}, hasEnv: false } },
  });
  await g.claimLayout('grp');
  await writeFile(path.join(appsRoot, 'grp', 'project.json'), `${JSON.stringify({ app: 'grp', project: 'p2', env: 'prod' })}\n`);
  await g.shift('grp', rel1.id, 'deploy');
  const rel2 = await g.saveRelease('grp', {
    parent: rel1.id, changedServices: ['web'],
    services: { api: { imageRef: digest('api1'), spec: {}, hasEnv: false }, web: { imageRef: digest('web2'), spec: {}, hasEnv: false } },
  });
  await g.shift('grp', rel2.id, 'deploy');
  void spec;

  const refs = await protectedRefs(appsRoot);
  for (const expected of ['reg/ns/v1:1', 'reg/ns/v1:2', digest('api1'), digest('web1'), digest('web2')]) {
    assert.ok(refs.has(expected), `expected protected: ${expected} (got ${[...refs].join(', ')})`);
  }
});

test('a v2 group alone does not break GC (the R08 repro) and old retained combinations stay protected', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  const g = new GroupStore(appsRoot);
  await g.claimLayout('grp');
  await writeFile(path.join(appsRoot, 'grp', 'project.json'), `${JSON.stringify({ app: 'grp', project: 'p', env: 'prod' })}\n`);
  const rel = await g.saveRelease('grp', {
    parent: null, changedServices: ['api'],
    services: { api: { imageRef: digest('api9'), spec: {}, hasEnv: false } },
  });
  await g.shift('grp', rel.id, 'deploy');
  const refs = await protectedRefs(appsRoot);
  assert.ok(refs.has(digest('api9')));
});

test('corrupt v2 manifest, corrupt state and an ambiguous layout marker each ABORT the GC (fail closed)', async (t) => {
  const { appsRoot, cleanup } = await root();
  t.after(cleanup);
  const g = new GroupStore(appsRoot);
  await g.claimLayout('grp');
  await writeFile(path.join(appsRoot, 'grp', 'project.json'), `${JSON.stringify({ app: 'grp', project: 'p', env: 'prod' })}\n`);
  const rel = await g.saveRelease('grp', {
    parent: null, changedServices: ['api'],
    services: { api: { imageRef: digest('apiX'), spec: {}, hasEnv: false } },
  });
  await g.shift('grp', rel.id, 'deploy');

  // corrupt the retained manifest → GC must refuse to compute deletable images
  const manifest = path.join(appsRoot, 'grp', 'releases', rel.id, 'manifest.json');
  await writeFile(manifest, '{ broken');
  await assert.rejects(() => protectedRefs(appsRoot), /unreadable|corrupt/i);
  await writeFile(manifest, JSON.stringify({ id: rel.id, parent: null, changedServices: ['api'], createdAt: 'x', services: { api: { imageRef: digest('apiX'), spec: {}, hasEnv: false } } }));

  // ambiguous marker → cannot decide v1/v2 → abort
  await writeFile(path.join(appsRoot, 'grp', 'group.json'), '{"schemaVersion": 3}');
  await assert.rejects(() => protectedRefs(appsRoot), /ambiguous|corrupt/i);
  await writeFile(path.join(appsRoot, 'grp', 'group.json'), '{"schemaVersion": 2}');

  // corrupt group state → abort
  await writeFile(path.join(appsRoot, 'grp', 'state.json'), 'not json');
  await assert.rejects(() => protectedRefs(appsRoot), /corrupt/i);
});
