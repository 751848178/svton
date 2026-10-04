import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readInitState, saveInitState, statePath, STATE_SCHEMA_VERSION, type InitState } from './state.js';

function sample(step: InitState['step']): InitState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    updatedAt: '',
    step,
    app: { name: 'demo-web', dockerfile: 'Dockerfile', ports: ['3000:3000'], healthcheckPath: '/health', healthcheckHostPort: 3000, envFile: null },
    machines: { builderUrl: 'https://builder.example.com', targetName: 'staging', runtimeUrl: 'https://runtime.example.com' },
    registry: { url: 'registry.example.com', namespace: 'myteam' },
  };
}

test('round-trips progress and strips secret-looking keys defensively', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-state-'));
  const state = sample('machines') as InitState & { builderToken?: string };
  state.builderToken = 'must-not-persist';
  await saveInitState(dir, state);

  const persisted = await readFile(statePath(dir), 'utf8');
  assert.ok(!persisted.includes('must-not-persist'), 'tokens must never land in init progress');
  assert.ok(!persisted.includes('token'), JSON.stringify(persisted));

  const back = await readInitState(dir);
  assert.equal(back!.step, 'machines');
  assert.equal(back!.app!.name, 'demo-web');
  assert.equal(back!.machines!.builderUrl, 'https://builder.example.com');
});

test('atomic save leaves no temp files and updates the timestamp', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-state-'));
  await saveInitState(dir, sample('app'));
  const before = (await readInitState(dir))!.updatedAt;
  await new Promise((r) => setTimeout(r, 10));
  await saveInitState(dir, sample('registry'));
  const after = (await readInitState(dir))!;
  assert.notEqual(before, after.updatedAt);
  const files = await readdir(path.join(dir, '.ship'));
  assert.deepEqual(files, ['init-state.json']);
});

test('missing or invalid progress is treated as absent (wizard restarts cleanly)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-state-'));
  assert.equal(await readInitState(dir), null);
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(path.join(dir, '.ship'), { recursive: true });
  await writeFile(statePath(dir), '{not json');
  assert.equal(await readInitState(dir), null);
  await writeFile(statePath(dir), JSON.stringify({ schemaVersion: 99, step: 'app' }));
  assert.equal(await readInitState(dir), null, 'unknown schema version is not resumable');
});
