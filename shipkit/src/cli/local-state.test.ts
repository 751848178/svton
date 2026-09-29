import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readLastBuild, saveLastBuild } from './local-state.js';

const realHome = process.env.HOME;

test('records are keyed per app — B cannot deploy with A record (F01)', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  await saveLastBuild({ app: 'alpha', imageRef: 'reg/alpha:1', tag: '1', at: new Date().toISOString(), builderUrl: 'http://x' });
  assert.equal((await readLastBuild('alpha'))?.imageRef, 'reg/alpha:1');
  assert.equal(await readLastBuild('beta'), null, 'no record may leak across apps');
});

test('legacy global record only resolves for its own app', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'ship-home-'));
  t.after(() => { process.env.HOME = realHome; });
  process.env.HOME = home;
  const { mkdir } = await import('node:fs/promises');
  await mkdir(path.join(home, '.ship'), { recursive: true });
  await writeFile(path.join(home, '.ship', 'last-build.json'), JSON.stringify({ app: 'gamma', imageRef: 'reg/gamma:9', tag: '9', at: 'x', builderUrl: 'http://x' }));
  assert.equal((await readLastBuild('gamma'))?.imageRef, 'reg/gamma:9');
  assert.equal(await readLastBuild('delta'), null);
});
