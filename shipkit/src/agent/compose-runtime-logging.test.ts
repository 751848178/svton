import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { load } from 'js-yaml';
import { exec } from '../shared/exec.js';
import { validateSpec } from '../shared/spec-schema.js';
import { validateServiceSpec } from '../shared/spec-v2.js';
import { renderComposeFile } from './compose.js';
import { renderServiceCompose } from './compose-service.js';
import { ReleaseStore } from './release.js';
import { GroupSnapshots } from './group-snapshots.js';

const logging = { maxSizeMiB: 10, maxFiles: 3 };
const expected = { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } };
const files = (image = 'server:fixture') => [
  renderComposeFile('server', image, validateSpec({ name: 'server', runtime: { logging } }), false),
  renderServiceCompose('fixture', 'server', image, validateServiceSpec('server', { runtime: { logging } }), false),
];

test('both renderers preserve bounded json-file options as strings and omit absent logging', () => {
  for (const content of files()) {
    const service = (load(content) as { services: { server: Record<string, unknown> } }).services.server;
    assert.deepEqual(service.logging, expected);
    assert.equal(service.restart, 'unless-stopped');
  }
  assert.doesNotMatch(renderComposeFile('server', 'server:fixture', { name: 'server' }, false), /logging:/);
  assert.doesNotMatch(renderServiceCompose('fixture', 'server', 'server:fixture', {}, false), /logging:/);
});

test('Compose normalizes the generated logging for both formats without daemon access', async t => {
  const version = await exec('docker', ['compose', 'version', '--short'], { timeoutMs: 10_000 });
  if (version.code !== 0) return t.skip('Docker Compose binary unavailable');
  const root = await mkdtemp(path.join(tmpdir(), 'ship-log-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'compose.env'), '');
  for (const content of files()) {
    await writeFile(path.join(root, 'compose.yaml'), content, { mode: 0o600 });
    const result = await exec('docker', ['compose', '--env-file', 'compose.env', '-p', 'ship_log_config', '-f', 'compose.yaml', 'config', '--format', 'json'],
      { cwd: root, timeoutMs: 15_000 });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).services.server.logging, expected);
  }
});

test('v1 and v2 snapshots retain logging for restore while inputs change', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-log-snapshot-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const singleStore = new ReleaseStore(root), groupStore = new GroupSnapshots(root);
  const singleSpec = validateSpec({ name: 'server', runtime: { logging, restartPolicy: 'on-failure:3' } });
  const groupSpec = validateServiceSpec('server', { runtime: { logging, restartPolicy: 'on-failure:3' } });
  const singleSaved = await singleStore.saveRelease('server', 'server:fixture', singleSpec);
  const groupSaved = await groupStore.save('group', { parent: null, changedServices: ['server'],
    services: { server: { imageRef: 'server:fixture', spec: groupSpec, hasEnv: false } } });
  singleSpec.runtime!.logging!.maxFiles = 9;
  groupSpec.runtime!.logging!.maxSizeMiB = 100;
  const single = await singleStore.loadRelease('server', singleSaved.id);
  const group = await groupStore.load('group', groupSaved.id);
  for (const content of [renderComposeFile('server', single.imageRef, single.spec, false),
    renderServiceCompose('group', 'server', group.services.server!.imageRef, group.services.server!.spec, false)]) {
    const service = (load(content) as { services: { server: Record<string, unknown> } }).services.server;
    assert.deepEqual(service.logging, expected);
    assert.equal(service.restart, 'on-failure:3');
  }
});

test('v1 and v2 snapshot loads reject altered drivers and unbounded log options', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'ship-log-corrupt-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const singleStore = new ReleaseStore(root), groupStore = new GroupSnapshots(root);
  for (const corrupt of [{ ...logging, driver: 'syslog' }, { ...logging, maxSizeMiB: 0 }]) {
    const singleSaved = await singleStore.saveRelease('server', 'server:fixture', validateSpec({ name: 'server', runtime: { logging } }));
    const groupSaved = await groupStore.save('group', { parent: null, changedServices: ['server'],
      services: { server: { imageRef: 'server:fixture', spec: validateServiceSpec('server', { runtime: { logging } }), hasEnv: false } } });
    const metaFile = path.join(root, 'server', 'releases', singleSaved.id, 'meta.json');
    const meta = JSON.parse(await readFile(metaFile, 'utf8'));
    meta.spec.runtime.logging = corrupt;
    await writeFile(metaFile, JSON.stringify(meta));
    await assert.rejects(() => singleStore.loadRelease('server', singleSaved.id), /runtime.logging/);
    const manifestFile = path.join(root, 'group', 'releases', groupSaved.id, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    manifest.services.server.spec.runtime.logging = corrupt;
    await writeFile(manifestFile, JSON.stringify(manifest));
    await assert.rejects(() => groupStore.load('group', groupSaved.id), /runtime.logging/);
  }
});

test('isolated stopped containers receive exact logging options from both renderers', async t => {
  const image = process.env.SHIPKIT_LOGGING_TEST_IMAGE;
  if (!image) return t.skip('set SHIPKIT_LOGGING_TEST_IMAGE to an existing cached image');
  const root = await mkdtemp(path.join(tmpdir(), 'ship-log-inspect-'));
  const project = `ship_log_${randomUUID().slice(0, 8)}`;
  const args = ['compose', '--env-file', 'compose.env', '-p', project, '-f', 'compose.yaml'];
  const run = (subcommand: string[]) => exec('docker', [...args, ...subcommand], { cwd: root, timeoutMs: 30_000 });
  t.after(async () => { await run(['down', '--remove-orphans']); await rm(root, { recursive: true, force: true }); });
  await writeFile(path.join(root, 'compose.env'), '');
  for (const [index, content] of files(image).entries()) {
    // No network, host mounts or process start is required to inspect LogConfig.
    await writeFile(path.join(root, 'compose.yaml'), content + '    network_mode: none\n', { mode: 0o600 });
    const created = await run(['create', '--pull', 'never', '--no-build']);
    assert.equal(created.code, 0, created.stderr);
    const ids = await run(['ps', '-a', '-q']);
    assert.equal(ids.code, 0, ids.stderr);
    assert.equal(ids.stdout.trim().split('\n').length, 1);
    const inspected = await exec('docker', ['inspect', '--format', '{{json .HostConfig.LogConfig}} {{.State.Status}} {{json .HostConfig.Binds}} {{.HostConfig.NetworkMode}}', ids.stdout.trim()], { timeoutMs: 15_000 });
    assert.equal(inspected.code, 0, inspected.stderr);
    const [config, status, binds, network] = inspected.stdout.trim().split(' ');
    assert.deepEqual(JSON.parse(config!), { Type: 'json-file', Config: expected.options });
    assert.equal(status, 'created');
    assert.equal(binds, 'null');
    assert.equal(network, 'none');
    t.diagnostic(JSON.stringify({ renderer: index === 0 ? 'v1' : 'v2', project,
      logging: JSON.parse(config!), status, binds, network }));
    const removed = await run(['down', '--remove-orphans']);
    assert.equal(removed.code, 0, removed.stderr);
  }
});
