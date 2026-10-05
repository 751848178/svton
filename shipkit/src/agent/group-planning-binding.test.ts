import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { groupRoutes } from './routes-groups.js';
import { GroupStore } from './group-store.js';
import { assertProjectBinding } from './project-binding.js';

const identity = { app: 'sample', project: 'project-a', env: 'prod' };
async function fixture(t: import('node:test').TestContext) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-planning-binding-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new GroupStore(path.join(dir, 'apps'));
  const route = groupRoutes({ workRoot: dir } as never).find((r) => r.method === 'GET')!;
  const read = (project = identity.project, env = identity.env) => route.handler({
    query: new URLSearchParams({ ...identity, project, env }), params: [], req: {} as never,
  });
  return { store, read };
}

for (const emptyDirectory of [false, true]) {
  test(`planning a ${emptyDirectory ? 'truly empty' : 'nonexistent'} group is read-only and remains unclaimed`, async (t) => {
    const { store, read } = await fixture(t);
    if (emptyDirectory) await mkdir(store.appDir(identity.app), { recursive: true });
    const result = await read();
    assert.equal(result.status, 200);
    assert.equal((result.body as { current: unknown }).current, null);
    assert.equal(existsSync(path.join(store.appDir(identity.app), 'project.json')), false);
    if (emptyDirectory) assert.deepEqual(await readdir(store.appDir(identity.app)), []);
    else assert.equal(existsSync(store.appDir(identity.app)), false);
  });
}

test('planning refuses missing binding for a committed group before returning its combination', async (t) => {
  const { store, read } = await fixture(t);
  await assertProjectBinding(store.appDir(identity.app), identity);
  await store.claimLayout(identity.app);
  const release = await store.saveRelease(identity.app, {
    parent: null, changedServices: ['api'], services: { api: { imageRef: `reg/ns/api@sha256:${'a'.repeat(64)}`, spec: {}, hasEnv: false } },
  });
  await store.shift(identity.app, release.id, 'deploy');
  const stateFile = path.join(store.appDir(identity.app), 'state.json');
  const stateBefore = await readFile(stateFile, 'utf8');
  await rm(path.join(store.appDir(identity.app), 'project.json'));
  for (const caller of [[identity.project, identity.env], ['other-project', 'staging']]) {
    await assert.rejects(read(caller[0], caller[1]), /绑定/);
  }
  assert.equal(await readFile(stateFile, 'utf8'), stateBefore);
  assert.equal(existsSync(path.join(store.appDir(identity.app), 'project.json')), false, 'read must never reclaim');
});

test('a layout marker or dangling binding link counts as existing evidence even without current state', async (t) => {
  const { store, read } = await fixture(t);
  await store.claimLayout(identity.app);
  await assert.rejects(read(), /绑定/);
  const binding = path.join(store.appDir(identity.app), 'project.json');
  await symlink('missing-original-binding.json', binding);
  await assert.rejects(read(), /绑定/);
  assert.ok((await readdir(store.appDir(identity.app))).includes('project.json'), 'dangling evidence is preserved');
});
