import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import { serializeRuntimeEnv } from '../shared/runtime-env.js';
import { renderServiceCompose } from './compose-service.js';

test('real Docker Compose config preserves serialized values without a second expansion', async t => {
  const version = await exec('docker', ['compose', 'version', '--short'], { timeoutMs: 10_000 });
  if (version.code !== 0) return t.skip('Docker Compose binary unavailable');
  const root = await mkdtemp(path.join(tmpdir(), 'ship-env-compose-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const expected = { DOLLAR: '$HOME ${FAKE_FROM_HOST} $$ $', HASH: ' # trailing # ', QUOTES: '"double" and \'single\'',
    BACKSLASH: 'C:\\fake\\folder\\file', EMPTY: '', UNICODE: '中文配置✓' };
  const env = serializeRuntimeEnv(expected);
  const compose = renderServiceCompose('demo', 'api', 'example/api:fixture', {}, true, env);
  assert.doesNotMatch(compose, /env_file/);
  await writeFile(path.join(root, 'compose.yaml'), compose, { mode: 0o600 });
  await writeFile(path.join(root, 'compose.env'), '');
  const result = await exec('docker', ['compose', '--env-file', 'compose.env', '-p', 'ship_env_fixture', '-f', 'compose.yaml', 'config', '--format', 'json'],
    { cwd: root, env: { FAKE_FROM_HOST: 'unexpected-host-value' }, timeoutMs: 15_000 });
  assert.equal(result.code, 0, result.stderr);
  // `config` escapes dollar signs again so its output can be reloaded.
  const normalized = Object.fromEntries(Object.entries(JSON.parse(result.stdout).services.api.environment as Record<string, string>)
    .map(([key, value]) => [key, value.replace(/\$\$/g, '$')]));
  assert.deepEqual(normalized, expected);
});

test('isolated Compose-created container receives exact runtime values', async t => {
  const image = process.env.SHIPKIT_COMPOSE_TEST_IMAGE;
  if (!image) return t.skip('set SHIPKIT_COMPOSE_TEST_IMAGE to an existing local fixture image');
  const root = await mkdtemp(path.join(tmpdir(), 'ship-env-container-'));
  const project = `ship_env_${randomUUID().slice(0, 8)}`;
  const expected = { SHIPKIT_TEST_DOLLAR: '$HOME ${FAKE_FROM_HOST} $$ $', SHIPKIT_TEST_HASH: ' # trailing # ',
    SHIPKIT_TEST_QUOTES: '"double" and \'single\'', SHIPKIT_TEST_SLASH: 'C:\\fake\\folder', SHIPKIT_TEST_EMPTY: '', SHIPKIT_TEST_UNICODE: '中文✓' };
  const args = ['compose', '--env-file', 'compose.env', '-p', project, '-f', 'compose.yaml'];
  const run = (subcommand: string[]) => exec('docker', [...args, ...subcommand], { cwd: root, timeoutMs: 30_000 });
  t.after(async () => { await run(['down', '--remove-orphans']); await rm(root, { recursive: true, force: true }); });
  await writeFile(path.join(root, 'compose.yaml'), renderServiceCompose('fixture', 'api', image, {}, true, serializeRuntimeEnv(expected)), { mode: 0o600 });
  await writeFile(path.join(root, 'compose.env'), '');
  const created = await run(['create', '--pull', 'never', '--no-build']);
  assert.equal(created.code, 0, created.stderr);
  const ids = await run(['ps', '-a', '-q']);
  assert.equal(ids.code, 0, ids.stderr);
  const inspect = await exec('docker', ['inspect', '--format', '{{json .Config.Env}}', ids.stdout.trim()], { timeoutMs: 15_000 });
  assert.equal(inspect.code, 0, inspect.stderr);
  const entries: string[] = JSON.parse(inspect.stdout);
  const actual = Object.fromEntries(entries.map(line => { const equal = line.indexOf('='); return [line.slice(0, equal), line.slice(equal + 1)]; }));
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, key);
});

test('legacy env files keep their original env_file handling', () => {
  const compose = renderServiceCompose('demo', 'api', 'example/api:fixture', {}, true, 'A=legacy\n');
  assert.match(compose, /env_file:/);
  assert.doesNotMatch(compose, /environment:/);
});
