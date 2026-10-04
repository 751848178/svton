// Last-build records are scoped per (app, project): a different repo with the
// SAME app name must never reuse this project's image, and unscoped legacy
// records (per-app or the 0.1.x global file) are never attributed to a project.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readLastBuild, saveLastBuild } from './local-state.js';

const realHome = process.env.HOME;
const REC = (project: string) => ({ app: 'alpha', project, imageRef: `reg/alpha:${project}`, tag: '1', at: new Date().toISOString(), builderUrl: 'http://x' });

test('records are keyed per (app, project) — same app in another repo never reuses the image', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  await saveLastBuild(REC('github.com/acme/shop'));
  assert.equal((await readLastBuild('alpha', 'github.com/acme/shop'))?.imageRef, 'reg/alpha:github.com/acme/shop');
  assert.equal(await readLastBuild('alpha', 'github.com/other/shop'), null, 'same app name, different repo — NO record may leak');
  assert.equal(await readLastBuild('beta', 'github.com/acme/shop'), null, 'no record may leak across apps');
  // two projects coexist; each reads back its own
  await saveLastBuild({ ...REC('github.com/other/shop'), imageRef: 'reg/alpha:other' });
  assert.equal((await readLastBuild('alpha', 'github.com/other/shop'))?.imageRef, 'reg/alpha:other');
  assert.equal((await readLastBuild('alpha', 'github.com/acme/shop'))?.imageRef, 'reg/alpha:github.com/acme/shop');
});

test('unscoped records are never written or attributed', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  await assert.rejects(() => saveLastBuild({ ...REC('p'), project: '' as unknown as string }), /project identity/);
  // legacy per-app file WITHOUT a project field is dead to every project
  await mkdir(path.join(home, '.ship'), { recursive: true });
  await writeFile(path.join(home, '.ship', 'last-build-alpha.json'), JSON.stringify({ app: 'alpha', imageRef: 'reg/alpha:legacy', tag: '1', at: 'x', builderUrl: 'http://x' }));
  assert.equal(await readLastBuild('alpha', 'p'), null, 'an unknown-owner legacy record must not leak across repos');
  // legacy per-app file that ALREADY carries this project's identity is honored
  await writeFile(path.join(home, '.ship', 'last-build-beta.json'), JSON.stringify({ app: 'beta', project: 'p', imageRef: 'reg/beta:legacy', tag: '1', at: 'x', builderUrl: 'http://x' }));
  assert.equal((await readLastBuild('beta', 'p'))?.imageRef, 'reg/beta:legacy');
  const files = await readdir(path.join(home, '.ship'));
  assert.ok(files.every((f) => !/^last-build-[a-z0-9-]+\.json$/.test(f) || f === 'last-build-alpha.json' || f === 'last-build-beta.json'), 'writes are always project-scoped files');
});
