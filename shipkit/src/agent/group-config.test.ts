import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mergeCombination } from './group-merge.js';
import { resolveServiceConfig } from './group-config.js';
import { GroupStore } from './group-store.js';
import { groupHistory } from './group-history.js';
import { assertProjectBinding } from './project-binding.js';
import { groupRoutes } from './routes-groups.js';
import type { GroupRelease, GroupServiceEntry } from './group-store-types.js';
import type { GroupConfigRef } from '../shared/group-protocol.js';

const image = `reg/api@sha256:${'a'.repeat(64)}`;
const ref = (serviceKey: string, version = '1.0.0'): GroupConfigRef => ({ versionId: `id-${version}`, version, name: '配置', serviceKey });
const entry = (service: string): GroupServiceEntry => ({ imageRef: image, spec: {}, env: `${service.toUpperCase()}=fake-old-value\n`, hasEnv: true,
  configRef: ref(service), source: { type: 'git', repo: 'https://github.com/team/repo', sha: 'a'.repeat(40) } });
const current: GroupRelease = { id: 'release-old', parent: null, changedServices: ['api', 'web'], createdAt: new Date().toISOString(),
  services: { api: entry('api'), web: entry('web') } };

test('partial config version, inherit and files preserve or clear references service by service', () => {
  const merged = mergeCombination({ group: 'demo', specs: { api: {}, web: {} }, current,
    changed: { api: { imageRef: image, configMode: 'version', envFileContent: '', configRef: ref('api', '1.0.1') } } });
  assert.equal(merged.combination.api!.hasEnv, true);
  assert.equal(merged.combination.api!.env, '');
  assert.equal(merged.combination.api!.configRef!.version, '1.0.1');
  assert.deepEqual(merged.combination.api!.source, current.services.api!.source);
  const unknownSource = mergeCombination({ group: 'demo', specs: { api: {}, web: {} }, current,
    changed: { api: { imageRef: `reg/api@sha256:${'b'.repeat(64)}`, configMode: 'inherit' } } });
  assert.equal(unknownSource.combination.api!.source, undefined, 'a changed image without provenance cannot claim the previous SHA');
  assert.deepEqual(merged.combination.web, current.services.web);
  for (const change of [{ imageRef: image, configMode: 'inherit' as const }, { imageRef: image, keepEnv: true }]) {
    assert.deepEqual(resolveServiceConfig('api', change, current.services.api), {
      hasEnv: true, env: current.services.api!.env, configRef: current.services.api!.configRef,
    });
  }
  assert.equal(resolveServiceConfig('api', { imageRef: image, configMode: 'files', envFileContent: 'NEW=fake-value' }, current.services.api).configRef, undefined);
  assert.equal(resolveServiceConfig('api', { imageRef: image, envFileContent: 'NEW=fake-value' }, current.services.api).configRef, undefined);
});

test('version requires explicit content or explicit noEnv, own service reference, and one strategy', () => {
  for (const change of [
    { imageRef: image, configMode: 'version' as const, configRef: ref('api') },
    { imageRef: image, configMode: 'version' as const, envFileContent: '', configRef: ref('web') },
    { imageRef: image, configMode: 'files' as const, envFileContent: '', configRef: ref('api') },
    { imageRef: image, configMode: 'inherit' as const, envFileContent: '' },
    { imageRef: image, configMode: 'version' as const, noEnv: true, envFileContent: '', configRef: ref('api') },
  ]) assert.throws(() => resolveServiceConfig('api', change, current.services.api), /configuration|reference|configRef|noEnv/);
  assert.throws(() => resolveServiceConfig('api', { imageRef: image, configMode: 'inherit' }), /current combination/);
  assert.deepEqual(resolveServiceConfig('api', { imageRef: image, configMode: 'version', noEnv: true, configRef: ref('api') }), {
    hasEnv: false, env: undefined, configRef: ref('api'),
  });
});

test('configuration references round-trip immutable snapshots and history without env disclosure', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-config-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new GroupStore(path.join(root, 'apps'));
  const identity = { app: 'demo', project: 'https://github.com/team/repo', env: 'test' };
  await assertProjectBinding(store.appDir('demo'), identity, false);
  await store.claimLayout('demo');
  const first = await store.saveRelease('demo', { parent: null, changedServices: ['api', 'web'], services: current.services });
  await store.shift('demo', first.id, 'deploy');
  const merged = mergeCombination({ group: 'demo', specs: { api: {}, web: {} }, current: first,
    changed: { api: { imageRef: image, configMode: 'version', envFileContent: 'API=fake-new-value\n', configRef: ref('api', '1.0.1') } } });
  const next = await store.saveRelease('demo', { parent: first.id, changedServices: merged.changedServices, services: merged.combination });
  await store.shift('demo', next.id, 'deploy');
  const loaded = await store.loadRelease('demo', next.id);
  assert.equal(loaded.services.api!.configRef!.version, '1.0.1');
  assert.equal(loaded.services.web!.configRef!.version, '1.0.0');
  const stateRoute = groupRoutes({ workRoot: root } as never).find(route => route.re.test('/api/group-state'))!;
  const view = await stateRoute.handler({ query: new URLSearchParams(identity) } as never);
  const publicState = view.body as import('../shared/group-protocol.js').GroupStateView;
  assert.deepEqual(publicState.services.api!.source, current.services.api!.source);
  assert.equal(publicState.services.api!.configRef!.version, '1.0.1');
  assert.doesNotMatch(JSON.stringify(publicState), /fake-old-value|fake-new-value/);
  const history = await groupHistory(store, identity);
  assert.equal(history.items[0]!.services.api!.configRef!.version, '1.0.1');
  assert.equal(history.items[0]!.restoreServices.api!.configRef!.version, '1.0.0');
  assert.doesNotMatch(JSON.stringify(history), /fake-old-value|fake-new-value/);
  const file = path.join(store.appDir('demo'), 'releases', next.id, 'manifest.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.services.api.configRef.serviceKey = 'web';
  await writeFile(file, JSON.stringify(manifest));
  await assert.rejects(() => store.loadRelease('demo', next.id), /reference/);
});
